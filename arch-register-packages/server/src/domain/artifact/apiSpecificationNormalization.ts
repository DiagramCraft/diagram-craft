import { createHash } from 'node:crypto';
import { Parser as AsyncApiParser } from '@asyncapi/parser';
import { validate as validateOpenApi } from '@scalar/openapi-parser';
import { parseDocument } from 'yaml';
import type {
  ApiSpecificationDiagnostic,
  ApiSpecificationDiagnosticCategory,
  ApiSpecificationItem,
  ApiSpecificationProtocol,
  ApiSpecificationSourceLocation
} from '@arch-register/api-types/artifactContract';

type JsonObject = Record<string, unknown>;
type NormalizationStatus = 'current' | 'invalid' | 'unsupported';

export type NormalizedApiSpecification = {
  status: NormalizationStatus;
  protocol: ApiSpecificationProtocol | null;
  specificationVersion: string | null;
  title: string | null;
  description: string | null;
  items: ApiSpecificationItem[];
  diagnostics: ApiSpecificationDiagnostic[];
};

const MAX_REF_RESOLUTIONS = 1_000;
const MAX_NORMALIZED_ITEMS = 10_000;
const MAX_SUMMARY_DEPTH = 5;
const MAX_SUMMARY_PROPERTIES = 50;
const MAX_SUMMARY_ENUM_VALUES = 20;
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
const ASYNC_API_ACTIONS = new Set(['publish', 'subscribe', 'send', 'receive']);

const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown) => (typeof value === 'string' ? value : null);

const pointerPart = (value: string | number) =>
  String(value).replaceAll('~', '~0').replaceAll('/', '~1');

const joinPointer = (base: string, part: string | number) => `${base}/${pointerPart(part)}`;

const source = (pointer: string): ApiSpecificationSourceLocation => ({
  pointer,
  line: null,
  column: null
});

const addDiagnostic = (
  diagnostics: ApiSpecificationDiagnostic[],
  input: {
    severity: 'error' | 'warning';
    category: ApiSpecificationDiagnosticCategory;
    code: string;
    message: string;
    pointer?: string;
  }
) => {
  diagnostics.push({
    severity: input.severity,
    category: input.category,
    code: input.code,
    message: input.message,
    source: input.pointer == null ? null : source(input.pointer)
  });
};

const diagnosticId = (revisionId: string, diagnostic: ApiSpecificationDiagnostic, index: number) =>
  createHash('sha256')
    .update(
      `${revisionId}:diagnostic:${index}:${diagnostic.code}:${diagnostic.source?.pointer ?? ''}`
    )
    .digest('hex');

const itemId = (revisionId: string, itemKey: string) =>
  createHash('sha256').update(`${revisionId}:item:${itemKey}`).digest('hex');

const getPointer = (root: unknown, pointer: string): unknown => {
  if (pointer === '#') return root;
  if (!pointer.startsWith('#/')) return undefined;
  const parts = pointer
    .slice(2)
    .split('/')
    .map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'));
  let current: unknown = root;
  for (const part of parts) {
    if (Array.isArray(current)) current = current[Number(part)];
    else if (isObject(current)) current = current[part];
    else return undefined;
  }
  return current;
};

const containsExternalReference = (value: unknown, seen = new Set<unknown>()): boolean => {
  if (typeof value === 'string') return false;
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some(item => containsExternalReference(item, seen));
  return Object.entries(value).some(([key, child]) =>
    key === '$ref' && typeof child === 'string'
      ? !child.startsWith('#')
      : containsExternalReference(child, seen)
  );
};

const makeResolver = (root: JsonObject, diagnostics: ApiSpecificationDiagnostic[]) => {
  let resolutions = 0;
  const resolve = (value: unknown, pointer: string, stack: string[] = []): unknown => {
    if (!isObject(value) || typeof value['$ref'] !== 'string') return value;
    const ref = value['$ref'];
    if (!ref.startsWith('#')) {
      addDiagnostic(diagnostics, {
        severity: 'warning',
        category: 'unresolved_reference',
        code: 'external_reference_not_fetched',
        message: `External reference '${ref}' was preserved but not fetched`,
        pointer
      });
      return { $ref: ref };
    }
    if (resolutions >= MAX_REF_RESOLUTIONS) {
      addDiagnostic(diagnostics, {
        severity: 'error',
        category: 'resource_limit',
        code: 'reference_limit_exceeded',
        message: `Reference resolution limit of ${MAX_REF_RESOLUTIONS} was exceeded`,
        pointer
      });
      return undefined;
    }
    if (stack.includes(ref)) {
      addDiagnostic(diagnostics, {
        severity: 'warning',
        category: 'unresolved_reference',
        code: 'circular_reference',
        message: `Circular local reference '${ref}' was preserved`,
        pointer
      });
      return { $ref: ref };
    }
    resolutions += 1;
    const target = getPointer(root, ref);
    if (target === undefined) {
      addDiagnostic(diagnostics, {
        severity: 'warning',
        category: 'unresolved_reference',
        code: 'local_reference_not_found',
        message: `Local reference '${ref}' could not be resolved`,
        pointer
      });
      return { $ref: ref };
    }
    return resolve(target, ref, [...stack, ref]);
  };
  return resolve;
};

const boundedValue = (value: unknown, depth = 0): unknown => {
  if (depth >= MAX_SUMMARY_DEPTH) return '[truncated]';
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value;
  if (Array.isArray(value))
    return value.slice(0, MAX_SUMMARY_PROPERTIES).map(item => boundedValue(item, depth + 1));
  if (!isObject(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_SUMMARY_PROPERTIES)
      .map(([key, child]) => [key, boundedValue(child, depth + 1)])
  );
};

const schemaSummary = (
  value: unknown,
  resolve: (value: unknown, pointer: string) => unknown,
  pointer: string,
  depth = 0
): JsonObject | null => {
  const resolved = resolve(value, pointer);
  if (!isObject(resolved)) return null;
  if (typeof resolved['$ref'] === 'string') return { $ref: resolved['$ref'] };
  if (depth >= MAX_SUMMARY_DEPTH) return { truncated: true };
  const result: JsonObject = {};
  for (const key of [
    'type',
    'format',
    'title',
    'description',
    'nullable',
    'readOnly',
    'writeOnly'
  ]) {
    if (resolved[key] !== undefined) result[key] = boundedValue(resolved[key]);
  }
  if (Array.isArray(resolved['required']))
    result['required'] = resolved['required'].slice(0, MAX_SUMMARY_PROPERTIES);
  if (Array.isArray(resolved['enum']))
    result['enum'] = resolved['enum']
      .slice(0, MAX_SUMMARY_ENUM_VALUES)
      .map(item => boundedValue(item));
  if (resolved['items'] !== undefined)
    result['items'] = schemaSummary(
      resolved['items'],
      resolve,
      joinPointer(pointer, 'items'),
      depth + 1
    );
  if (isObject(resolved['properties'])) {
    result['properties'] = Object.fromEntries(
      Object.entries(resolved['properties'])
        .slice(0, MAX_SUMMARY_PROPERTIES)
        .map(([key, child]) => [
          key,
          schemaSummary(
            child,
            resolve,
            joinPointer(joinPointer(pointer, 'properties'), key),
            depth + 1
          )
        ])
    );
  }
  return result;
};

const normalizeTags = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(value.filter((tag): tag is string => typeof tag === 'string'))]
    : [];

const uniqueIdentifier = (
  declaredIdentifier: string | null,
  generatedIdentifier: string,
  used: Set<string>,
  diagnostics: ApiSpecificationDiagnostic[],
  pointer: string
) => {
  const base = declaredIdentifier ?? generatedIdentifier;
  let identifier = base;
  let suffix = 2;
  if (declaredIdentifier == null) {
    addDiagnostic(diagnostics, {
      severity: 'warning',
      category: 'missing_identifier',
      code: 'identifier_missing',
      message: `No declared identifier was provided; generated '${generatedIdentifier}'`,
      pointer
    });
  } else if (used.has(declaredIdentifier)) {
    addDiagnostic(diagnostics, {
      severity: 'warning',
      category: 'duplicate_identifier',
      code: 'identifier_duplicate',
      message: `Identifier '${declaredIdentifier}' is duplicated; generated a stable suffix`,
      pointer
    });
    identifier = generatedIdentifier;
  }
  while (used.has(identifier)) identifier = `${base}#${suffix++}`;
  used.add(identifier);
  return identifier;
};

const validatorMessage = (error: unknown) => {
  if (isObject(error) && typeof error['message'] === 'string') return error['message'];
  return String(error);
};

const validatorPointer = (error: unknown) => {
  if (!isObject(error)) return undefined;
  const path = error['path'];
  if (Array.isArray(path)) return `#/${path.map(part => pointerPart(String(part))).join('/')}`;
  return undefined;
};

const runOpenApiValidation = async (
  root: JsonObject,
  diagnostics: ApiSpecificationDiagnostic[]
) => {
  if (containsExternalReference(root)) return;
  try {
    const result = await validateOpenApi(root);
    if (result.valid) return;
    for (const error of result.errors ?? []) {
      addDiagnostic(diagnostics, {
        severity: 'error',
        category: 'validation_error',
        code: error.code ?? 'openapi_validation_error',
        message: error.message,
        pointer: error.path == null ? undefined : `#/${error.path.map(pointerPart).join('/')}`
      });
    }
  } catch (error) {
    addDiagnostic(diagnostics, {
      severity: 'error',
      category: 'validation_error',
      code: 'openapi_validator_error',
      message: validatorMessage(error)
    });
  }
};

const runAsyncApiValidation = async (
  root: JsonObject,
  diagnostics: ApiSpecificationDiagnostic[]
) => {
  if (containsExternalReference(root)) return;
  try {
    const parser = new AsyncApiParser();
    const results = await parser.validate(root as never);
    for (const result of results) {
      const severity = String(result.severity).toLowerCase();
      addDiagnostic(diagnostics, {
        severity: severity === 'error' ? 'error' : 'warning',
        category: 'validation_error',
        code: String(result.code ?? 'asyncapi_validation_error'),
        message: result.message,
        pointer: validatorPointer(result)
      });
    }
  } catch (error) {
    addDiagnostic(diagnostics, {
      severity: 'error',
      category: 'validation_error',
      code: 'asyncapi_validator_error',
      message: validatorMessage(error)
    });
  }
};

const openApiItems = (
  root: JsonObject,
  revisionId: string,
  diagnostics: ApiSpecificationDiagnostic[],
  resolve: (value: unknown, pointer: string) => unknown
) => {
  const items: ApiSpecificationItem[] = [];
  const usedIdentifiers = new Set<string>();
  const paths = isObject(root['paths']) ? root['paths'] : {};
  for (const path of Object.keys(paths).sort()) {
    const pathPointer = joinPointer('#/paths', path);
    if (!path.startsWith('/')) {
      addDiagnostic(diagnostics, {
        severity: 'warning',
        category: 'unsupported_construct',
        code: 'malformed_path',
        message: `Skipped path '${path}' because OpenAPI paths must begin with '/'`,
        pointer: pathPointer
      });
      continue;
    }
    if ((path.match(/{/g)?.length ?? 0) !== (path.match(/}/g)?.length ?? 0)) {
      addDiagnostic(diagnostics, {
        severity: 'warning',
        category: 'unsupported_construct',
        code: 'malformed_path_template',
        message: `Path '${path}' has unbalanced template delimiters`,
        pointer: pathPointer
      });
    }
    const pathItem = resolve(paths[path], pathPointer);
    if (!isObject(pathItem)) continue;
    for (const method of [...HTTP_METHODS].sort()) {
      if (pathItem[method] === undefined) continue;
      const operationPointer = joinPointer(pathPointer, method);
      const operation = resolve(pathItem[method], operationPointer);
      if (!isObject(operation)) {
        addDiagnostic(diagnostics, {
          severity: 'warning',
          category: 'unsupported_construct',
          code: 'operation_not_object',
          message: `Skipped ${method.toUpperCase()} ${path} because the operation is not an object`,
          pointer: operationPointer
        });
        continue;
      }
      const declaredIdentifier = asString(operation['operationId']);
      const identifier = uniqueIdentifier(
        declaredIdentifier,
        `${method.toUpperCase()} ${path}`,
        usedIdentifiers,
        diagnostics,
        operationPointer
      );
      const parameters = [
        ...(Array.isArray(pathItem['parameters']) ? pathItem['parameters'] : []),
        ...(Array.isArray(operation['parameters']) ? operation['parameters'] : [])
      ]
        .map((parameter, index) => {
          const parameterPointer = joinPointer(joinPointer(operationPointer, 'parameters'), index);
          const resolved = resolve(parameter, parameterPointer);
          if (!isObject(resolved)) return null;
          return {
            name: asString(resolved['name']),
            in: asString(resolved['in']),
            required: resolved['required'] === true,
            description: asString(resolved['description']),
            schema: schemaSummary(
              resolved['schema'],
              resolve,
              joinPointer(parameterPointer, 'schema')
            )
          };
        })
        .filter(parameter => parameter != null) as Record<string, unknown>[];
      const requestBody = resolve(
        operation['requestBody'],
        joinPointer(operationPointer, 'requestBody')
      );
      const input = isObject(requestBody)
        ? {
            description: asString(requestBody['description']),
            required: requestBody['required'] === true,
            content: isObject(requestBody['content'])
              ? Object.fromEntries(
                  Object.entries(requestBody['content']).map(([mediaType, media]) => [
                    mediaType,
                    isObject(media)
                      ? {
                          schema: schemaSummary(
                            media['schema'],
                            resolve,
                            joinPointer(
                              joinPointer(joinPointer(operationPointer, 'requestBody'), 'content'),
                              mediaType
                            )
                          )
                        }
                      : {}
                  ])
                )
              : {}
          }
        : null;
      const responses = isObject(operation['responses'])
        ? Object.entries(operation['responses']).map(([status, response]) => {
            const responsePointer = joinPointer(joinPointer(operationPointer, 'responses'), status);
            const resolved = resolve(response, responsePointer);
            return {
              status,
              description: isObject(resolved) ? asString(resolved['description']) : null,
              content:
                isObject(resolved) && isObject(resolved['content'])
                  ? Object.fromEntries(
                      Object.entries(resolved['content']).map(([mediaType, media]) => [
                        mediaType,
                        isObject(media)
                          ? {
                              schema: schemaSummary(
                                media['schema'],
                                resolve,
                                joinPointer(
                                  joinPointer(joinPointer(responsePointer, 'content'), mediaType),
                                  'schema'
                                )
                              )
                            }
                          : {}
                      ])
                    )
                  : {}
            };
          })
        : [];
      const itemKey = operationPointer;
      items.push({
        id: itemId(revisionId, itemKey),
        itemKey,
        revisionId,
        protocol: 'openapi',
        itemKind: 'operation',
        path,
        channel: null,
        action: method,
        identifier,
        declaredIdentifier,
        summary: asString(operation['summary']),
        description: asString(operation['description']),
        tags: normalizeTags(operation['tags']),
        deprecated: operation['deprecated'] === true,
        parameters,
        input,
        output: { responses },
        metadata: {
          servers: boundedValue(operation['servers']) ?? [],
          security: boundedValue(operation['security']) ?? []
        },
        source: source(operationPointer)
      });
      if (items.length >= MAX_NORMALIZED_ITEMS) return items;
    }
    if (items.length >= MAX_NORMALIZED_ITEMS) return items;
  }
  if (isObject(root['webhooks'])) {
    addDiagnostic(diagnostics, {
      severity: 'warning',
      category: 'unsupported_construct',
      code: 'webhooks_not_normalized',
      message:
        'OpenAPI webhooks are preserved in the source document but are not normalized as operations',
      pointer: '#/webhooks'
    });
  }
  return items;
};

const asyncMessage = (
  messageValue: unknown,
  messagePointer: string,
  resolve: (value: unknown, pointer: string) => unknown
) => {
  const message = resolve(messageValue, messagePointer);
  return isObject(message) ? message : {};
};

const asyncMessageItem = (
  revisionId: string,
  diagnostics: ApiSpecificationDiagnostic[],
  resolve: (value: unknown, pointer: string) => unknown,
  usedIdentifiers: Set<string>,
  itemKey: string,
  channel: string | null,
  action: string,
  operation: JsonObject,
  channelParameters: unknown,
  messageValue: unknown,
  messagePointer: string
): ApiSpecificationItem => {
  const message = asyncMessage(messageValue, messagePointer, resolve);
  const declaredIdentifier =
    asString(message['messageId']) ?? asString(message['name']) ?? asString(message['id']);
  const generated = `${action.toUpperCase()} ${channel ?? 'message'}`;
  const identifier = uniqueIdentifier(
    declaredIdentifier,
    generated,
    usedIdentifiers,
    diagnostics,
    messagePointer
  );
  const payload = schemaSummary(
    message['payload'],
    resolve,
    joinPointer(messagePointer, 'payload')
  );
  const headers = schemaSummary(
    message['headers'],
    resolve,
    joinPointer(messagePointer, 'headers')
  );
  const isInput = action === 'publish' || action === 'send';
  const parameters = isObject(channelParameters)
    ? Object.entries(channelParameters).map(([name, value]) => {
        const bounded = boundedValue(value);
        return {
          name,
          ...(isObject(bounded) ? bounded : { value: bounded })
        };
      })
    : Array.isArray(operation['parameters'])
      ? operation['parameters']
          .map(value => boundedValue(value))
          .filter((value): value is Record<string, unknown> => isObject(value))
      : [];
  const metadata: JsonObject = {
    operationId: asString(operation['operationId']),
    messageName: asString(message['name']),
    headers,
    bindings: boundedValue(message['bindings']) ?? {},
    correlationId: boundedValue(message['correlationId']) ?? null
  };
  return {
    id: itemId(revisionId, itemKey),
    itemKey,
    revisionId,
    protocol: 'asyncapi',
    itemKind: 'message',
    path: null,
    channel,
    action,
    identifier,
    declaredIdentifier,
    summary: asString(message['summary']) ?? asString(operation['summary']),
    description: asString(message['description']) ?? asString(operation['description']),
    tags: normalizeTags(message['tags'] ?? operation['tags']),
    deprecated: message['deprecated'] === true || operation['deprecated'] === true,
    parameters,
    input: isInput ? { payload } : null,
    output: isInput ? null : { payload },
    metadata,
    source: source(messagePointer)
  };
};

const asyncApiItems = (
  root: JsonObject,
  revisionId: string,
  diagnostics: ApiSpecificationDiagnostic[],
  resolve: (value: unknown, pointer: string) => unknown
) => {
  const items: ApiSpecificationItem[] = [];
  const usedIdentifiers = new Set<string>();
  const addOperationMessages = (
    operationPointer: string,
    channel: string | null,
    action: string,
    operation: JsonObject,
    channelParameters: unknown,
    messages: unknown[]
  ) => {
    if (!ASYNC_API_ACTIONS.has(action)) {
      addDiagnostic(diagnostics, {
        severity: 'warning',
        category: 'unsupported_construct',
        code: 'unsupported_asyncapi_action',
        message: `AsyncAPI action '${action}' was not normalized`,
        pointer: operationPointer
      });
      return;
    }
    const values = messages.length > 0 ? messages : [undefined];
    values.forEach((message, index) => {
      const messagePointer = joinPointer(joinPointer(operationPointer, 'messages'), index);
      const itemKey = message === undefined ? operationPointer : messagePointer;
      items.push(
        asyncMessageItem(
          revisionId,
          diagnostics,
          resolve,
          usedIdentifiers,
          itemKey,
          channel,
          action,
          operation,
          channelParameters,
          message,
          messagePointer
        )
      );
    });
  };

  if (root['asyncapi']?.toString().startsWith('3.')) {
    const operations = isObject(root['operations']) ? root['operations'] : {};
    for (const operationName of Object.keys(operations).sort()) {
      const operationPointer = joinPointer('#/operations', operationName);
      const operation = resolve(operations[operationName], operationPointer);
      if (!isObject(operation)) continue;
      const action = asString(operation['action']) ?? 'receive';
      const channelValue = resolve(operation['channel'], joinPointer(operationPointer, 'channel'));
      let channel: string | null = null;
      if (isObject(operation['channel']) && typeof operation['channel']['$ref'] === 'string') {
        const ref = operation['channel']['$ref'];
        const channelKey = ref.startsWith('#/channels/')
          ? ref.slice('#/channels/'.length).replaceAll('~1', '/')
          : null;
        channel = channelKey;
      } else if (isObject(channelValue)) {
        channel = asString(channelValue['address']);
      }
      const messages = Array.isArray(operation['messages']) ? operation['messages'] : [];
      addOperationMessages(
        operationPointer,
        channel,
        action,
        operation,
        isObject(channelValue) ? channelValue['parameters'] : undefined,
        messages
      );
      if (items.length >= MAX_NORMALIZED_ITEMS) break;
    }
  } else {
    const channels = isObject(root['channels']) ? root['channels'] : {};
    for (const channelName of Object.keys(channels).sort()) {
      const channelPointer = joinPointer('#/channels', channelName);
      const channel = resolve(channels[channelName], channelPointer);
      if (!isObject(channel)) continue;
      for (const action of ['publish', 'subscribe']) {
        const operationPointer = joinPointer(channelPointer, action);
        const operation = resolve(channel[action], operationPointer);
        if (!isObject(operation)) continue;
        const message = operation['message'];
        const messages =
          isObject(message) && Array.isArray(message['oneOf'])
            ? message['oneOf']
            : message === undefined
              ? []
              : [message];
        addOperationMessages(
          operationPointer,
          channelName,
          action,
          operation,
          channel['parameters'],
          messages
        );
        if (items.length >= MAX_NORMALIZED_ITEMS) break;
      }
      if (items.length >= MAX_NORMALIZED_ITEMS) break;
    }
  }
  return items.slice(0, MAX_NORMALIZED_ITEMS);
};

const parseDocumentContent = (content: string) => {
  const document = parseDocument(content);
  if (document.errors.length > 0)
    throw new Error(document.errors.map(error => error.message).join('; '));
  const value = document.toJS();
  if (!isObject(value)) throw new Error('Specification root must be an object');
  return value;
};

export const normalizeApiSpecification = async (
  revisionId: string,
  content: string,
  mediaType: string | null
): Promise<NormalizedApiSpecification> => {
  const normalizedMediaType = mediaType?.split(';')[0]?.trim().toLowerCase();
  if (
    normalizedMediaType != null &&
    !['application/json', 'application/yaml', 'application/x-yaml', 'text/yaml'].includes(
      normalizedMediaType
    ) &&
    !normalizedMediaType.endsWith('+json') &&
    !normalizedMediaType.endsWith('+yaml')
  ) {
    return {
      status: 'unsupported',
      protocol: null,
      specificationVersion: null,
      title: null,
      description: null,
      items: [],
      diagnostics: [
        {
          severity: 'error',
          category: 'unsupported_media_type',
          code: 'unsupported_media_type',
          message: `Media type '${mediaType}' is not a supported JSON or YAML representation`,
          source: null
        }
      ]
    };
  }
  let root: JsonObject;
  try {
    root = parseDocumentContent(content);
  } catch (error) {
    return {
      status: 'invalid',
      protocol: null,
      specificationVersion: null,
      title: null,
      description: null,
      items: [],
      diagnostics: [
        {
          severity: 'error',
          category: 'parse_error',
          code: 'document_parse_error',
          message: validatorMessage(error),
          source: null
        }
      ]
    };
  }

  const diagnostics: ApiSpecificationDiagnostic[] = [];
  const openapiVersion = asString(root['openapi']);
  const asyncapiVersion = asString(root['asyncapi']);
  const protocol: ApiSpecificationProtocol | null =
    openapiVersion != null ? 'openapi' : asyncapiVersion != null ? 'asyncapi' : null;
  const specificationVersion = openapiVersion ?? asyncapiVersion;
  if (protocol == null) {
    addDiagnostic(diagnostics, {
      severity: 'error',
      category: 'validation_error',
      code: 'protocol_missing',
      message: "Document must declare either 'openapi' or 'asyncapi'"
    });
    return {
      status: 'invalid',
      protocol: null,
      specificationVersion: null,
      title: null,
      description: null,
      items: [],
      diagnostics
    };
  }
  const supported =
    protocol === 'openapi'
      ? /^3\.(0|1)(?:\.\d+)?$/.test(specificationVersion ?? '')
      : /^(?:2\.\d+\.\d+|3\.0\.\d+)$/.test(specificationVersion ?? '');
  if (!supported) {
    addDiagnostic(diagnostics, {
      severity: 'error',
      category: 'unsupported_version',
      code: 'unsupported_version',
      message: `${protocol === 'openapi' ? 'OpenAPI' : 'AsyncAPI'} version '${specificationVersion}' is outside the supported range`,
      pointer: protocol === 'openapi' ? '#/openapi' : '#/asyncapi'
    });
    return {
      status: 'unsupported',
      protocol,
      specificationVersion,
      title: asString(isObject(root['info']) ? root['info']['title'] : null),
      description: asString(isObject(root['info']) ? root['info']['description'] : null),
      items: [],
      diagnostics
    };
  }

  const resolve = makeResolver(root, diagnostics);
  if (protocol === 'openapi') await runOpenApiValidation(root, diagnostics);
  else await runAsyncApiValidation(root, diagnostics);
  const items =
    protocol === 'openapi'
      ? openApiItems(root, revisionId, diagnostics, resolve)
      : asyncApiItems(root, revisionId, diagnostics, resolve);
  if (items.length >= MAX_NORMALIZED_ITEMS) {
    addDiagnostic(diagnostics, {
      severity: 'error',
      category: 'resource_limit',
      code: 'item_limit_exceeded',
      message: `Normalization stopped at the limit of ${MAX_NORMALIZED_ITEMS} items`
    });
  }
  const hasErrors = diagnostics.some(diagnostic => diagnostic.severity === 'error');
  return {
    status: hasErrors ? 'invalid' : 'current',
    protocol,
    specificationVersion,
    title: asString(isObject(root['info']) ? root['info']['title'] : root['title']),
    description: asString(
      isObject(root['info']) ? root['info']['description'] : root['description']
    ),
    items,
    diagnostics
  };
};

export const diagnosticDbId = diagnosticId;
