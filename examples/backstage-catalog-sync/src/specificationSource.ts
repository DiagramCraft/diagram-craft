import { posix } from 'node:path';
import YAML from 'yaml';
import { fetchGitHubFile, type GitHubFile, type GitHubRepo } from './github.js';

export type ResolvedSpecificationSource =
  | {
      kind: 'document';
      sourceKey: string;
      content: string;
      location: string | null;
      mediaType: string;
      sourceRevision: string | null;
    }
  | {
      kind: 'link';
      sourceKey: string;
      location: string;
      mediaType: null;
    }
  | {
      kind: 'missing';
      sourceKey: string;
    };

export class SpecificationResolutionError extends Error {
  constructor(
    message: string,
    readonly category: 'missing' | 'invalid' | 'unavailable' = 'invalid'
  ) {
    super(message);
    this.name = 'SpecificationResolutionError';
  }
}

const MAX_SPECIFICATION_BYTES = 2_000_000;

const mediaTypeForPath = (path: string): string => {
  const extension = path.split('.').pop()?.toLowerCase();
  return extension === 'json' ? 'application/json' : 'application/yaml';
};

const githubFileLocation = (repo: GitHubRepo, file: GitHubFile): string =>
  file.htmlUrl ?? `https://github.com/${repo.fullName}/blob/${repo.defaultBranch}/${file.path}`;

const resolveRepositoryPath = (catalogPath: string, reference: string): string => {
  const path = posix.normalize(posix.join(posix.dirname(catalogPath), reference));
  if (path.startsWith('../') || path === '..' || path.includes('/../')) {
    throw new SpecificationResolutionError(
      'Referenced Backstage source path escapes the repository'
    );
  }
  return path;
};

const fetchRemoteSource = async (reference: string) => {
  let url: URL;
  try {
    url = new URL(reference);
  } catch {
    throw new SpecificationResolutionError('Referenced Backstage source is not a valid URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new SpecificationResolutionError(
      'Referenced Backstage source must use HTTPS without credentials'
    );
  }

  let response: Response;
  try {
    response = await fetch(url, { redirect: 'follow' });
  } catch {
    throw new SpecificationResolutionError('Referenced HTTPS source could not be fetched');
  }
  let finalUrl: URL;
  try {
    finalUrl = new URL(response.url || url.toString());
  } catch {
    throw new SpecificationResolutionError('Referenced HTTPS source returned an invalid URL');
  }
  if (finalUrl.protocol !== 'https:' || finalUrl.username || finalUrl.password) {
    throw new SpecificationResolutionError(
      'Referenced HTTPS source redirected to an unsafe protocol'
    );
  }
  if (!response.ok) {
    throw new SpecificationResolutionError(
      `Referenced HTTPS source returned HTTP ${response.status}`,
      response.status === 404 ? 'missing' : 'unavailable'
    );
  }
  const contentLength = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(contentLength) && contentLength > MAX_SPECIFICATION_BYTES) {
    throw new SpecificationResolutionError('Referenced HTTPS source exceeds the 2 MB limit');
  }
  const content = await response.text();
  if (Buffer.byteLength(content, 'utf8') > MAX_SPECIFICATION_BYTES) {
    throw new SpecificationResolutionError('Referenced HTTPS source exceeds the 2 MB limit');
  }
  return {
    content,
    location: finalUrl.toString(),
    mediaType:
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      mediaTypeForPath(finalUrl.pathname),
    sourceRevision: response.headers.get('etag') ?? response.headers.get('last-modified') ?? null
  };
};

const fetchReference = async (
  reference: string,
  repo: GitHubRepo,
  catalogFile: GitHubFile,
  token?: string
) => {
  if (/^https:\/\//i.test(reference)) {
    return fetchRemoteSource(reference);
  }
  const file = await fetchGitHubFile(
    repo,
    resolveRepositoryPath(catalogFile.path, reference),
    token
  );
  if (!file) {
    throw new SpecificationResolutionError(
      'Referenced GitHub source file was not found',
      'missing'
    );
  }
  return {
    content: file.content,
    location: githubFileLocation(repo, file),
    mediaType: mediaTypeForPath(file.path),
    sourceRevision: file.sha
  };
};

const substituteContent = (operator: '$text' | '$json' | '$yaml', content: string): string => {
  if (operator === '$text') return content;
  try {
    const parsed = operator === '$json' ? JSON.parse(content) : YAML.parse(content);
    return operator === '$json' ? JSON.stringify(parsed, null, 2) : YAML.stringify(parsed);
  } catch {
    throw new SpecificationResolutionError(
      `Backstage ${operator} substitution is not valid structured content`
    );
  }
};

export const resolveBackstageSpecification = async (
  definition: unknown,
  sourceKey: string,
  repo: GitHubRepo,
  catalogFile: GitHubFile,
  token: string | undefined,
  fallbackLink: string | null
): Promise<ResolvedSpecificationSource> => {
  if (definition === undefined || definition === null) {
    return fallbackLink
      ? { kind: 'link', sourceKey, location: fallbackLink, mediaType: null }
      : { kind: 'missing', sourceKey };
  }

  if (typeof definition === 'string') {
    if (Buffer.byteLength(definition, 'utf8') > MAX_SPECIFICATION_BYTES) {
      throw new SpecificationResolutionError(
        'Inline Backstage API definition exceeds the 2 MB limit'
      );
    }
    return {
      kind: 'document',
      sourceKey,
      content: definition,
      location: githubFileLocation(repo, catalogFile),
      mediaType: 'application/yaml',
      sourceRevision: catalogFile.sha
    };
  }

  if (typeof definition !== 'object' || Array.isArray(definition)) {
    throw new SpecificationResolutionError(
      'Backstage spec.definition must be text or a supported substitution'
    );
  }
  const entries = Object.entries(definition);
  if (entries.length !== 1 || !['$text', '$json', '$yaml'].includes(entries[0]?.[0] ?? '')) {
    throw new SpecificationResolutionError(
      'Backstage spec.definition uses an unsupported substitution'
    );
  }
  const operator = entries[0]![0] as '$text' | '$json' | '$yaml';
  const reference = entries[0]![1];
  if (typeof reference !== 'string' || reference.trim().length === 0) {
    throw new SpecificationResolutionError(
      `Backstage ${operator} substitution must name a source file or URL`
    );
  }
  const fetched = await fetchReference(reference.trim(), repo, catalogFile, token);
  const content = substituteContent(operator, fetched.content);
  if (Buffer.byteLength(content, 'utf8') > MAX_SPECIFICATION_BYTES) {
    throw new SpecificationResolutionError(
      'Resolved Backstage API definition exceeds the 2 MB limit'
    );
  }
  return {
    kind: 'document',
    sourceKey,
    content,
    location: fetched.location,
    mediaType: fetched.mediaType,
    sourceRevision: fetched.sourceRevision
  };
};
