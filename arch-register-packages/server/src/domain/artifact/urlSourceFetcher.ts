import { request as httpsRequest, type RequestOptions } from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import { isIP } from 'node:net';
import type { ArtifactDiagnosticCategory } from '@arch-register/api-types/artifactContract';
import {
  resolvePublicOutboundHost,
  type ResolvedOutboundAddress,
  UnsafeOutboundHostError
} from '../../utils/outboundUrlSafety';

export const MAX_URL_SOURCE_BYTES = 2_000_000;
export const MAX_URL_SOURCE_REDIRECTS = 3;
export const URL_SOURCE_TIMEOUT_MS = 10_000;

const USER_AGENT = 'Arch-Register/API-Specification';

export class UrlSourceFetchError extends Error {
  constructor(
    readonly category: Extract<
      ArtifactDiagnosticCategory,
      | 'invalid_source'
      | 'unsupported_media_type'
      | 'source_unavailable'
      | 'source_forbidden'
      | 'source_timeout'
      | 'source_too_large'
      | 'security_blocked'
    >,
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'UrlSourceFetchError';
  }
}

type UrlSourceFetchResult = {
  content: string;
  mediaType: string | null;
  sourceRevision: string | null;
};

type RedirectResult = { redirect: string };
type BodyResult = { response: UrlSourceFetchResult };

const headerValue = (headers: IncomingHttpHeaders, name: string) => {
  const value = headers[name];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
};

const parseContentLength = (headers: IncomingHttpHeaders) => {
  const value = headerValue(headers, 'content-length');
  if (!value) return null;
  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 ? length : null;
};

const isAbortError = (error: unknown) =>
  error instanceof Error && (error.name === 'AbortError' || error.message === 'aborted');

export const validateRemoteFetchUrl = (value: string | URL) => {
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value.toString()) : new URL(value.trim());
  } catch {
    throw new UrlSourceFetchError('invalid_source', 'URL source must be a valid absolute URL');
  }
  if (url.protocol !== 'https:') {
    throw new UrlSourceFetchError('invalid_source', 'URL source must use HTTPS');
  }
  if (url.username || url.password) {
    throw new UrlSourceFetchError('invalid_source', 'URL source must not contain credentials');
  }
  if (url.hash) {
    throw new UrlSourceFetchError('invalid_source', 'URL source must not contain a fragment');
  }
  return url;
};

const resolveAddresses = async (url: URL): Promise<ResolvedOutboundAddress[]> => {
  try {
    return await resolvePublicOutboundHost(
      url.hostname,
      'URL source host must be publicly routable'
    );
  } catch (error) {
    if (error instanceof UnsafeOutboundHostError) {
      throw new UrlSourceFetchError('security_blocked', 'URL source host is not publicly routable');
    }
    throw new UrlSourceFetchError(
      'source_unavailable',
      'URL source host could not be resolved',
      true
    );
  }
};

const requestUrl = async (url: URL, signal: AbortSignal): Promise<BodyResult | RedirectResult> => {
  const addresses = await resolveAddresses(url);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const firstAddress = addresses[0];

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };
    const fail = (error: unknown) => {
      finish(() => {
        if (signal.aborted || isAbortError(error)) {
          reject(new Error('URL source fetch was aborted'));
          return;
        }
        if (error instanceof UrlSourceFetchError) {
          reject(error);
          return;
        }
        reject(
          new UrlSourceFetchError('source_unavailable', 'URL source could not be fetched', true)
        );
      });
    };

    const requestOptions: RequestOptions = {
      protocol: 'https:',
      hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        accept: 'application/json, application/yaml, application/x-yaml, text/yaml, */*;q=0.1',
        'accept-encoding': 'identity',
        'user-agent': USER_AGENT
      },
      signal
    };

    if (firstAddress) {
      requestOptions.lookup = (_hostname, _options, callback) => {
        callback(null, firstAddress.address, firstAddress.family);
      };
    }
    if (isIP(hostname) === 0) {
      (requestOptions as RequestOptions & { servername?: string }).servername = hostname;
    }

    const request = httpsRequest(requestOptions, response => {
      const status = response.statusCode ?? 0;
      const location = headerValue(response.headers, 'location');
      if (status >= 300 && status < 400) {
        response.resume();
        if (!location) {
          fail(
            new UrlSourceFetchError(
              'invalid_source',
              'URL source returned a redirect without a destination'
            )
          );
          return;
        }
        finish(() => resolve({ redirect: location }));
        return;
      }
      if (status === 401 || status === 403) {
        response.resume();
        fail(new UrlSourceFetchError('source_forbidden', `URL source returned HTTP ${status}`));
        return;
      }
      if (status === 408 || status === 429 || status >= 500) {
        response.resume();
        fail(
          new UrlSourceFetchError(
            status === 408 ? 'source_timeout' : 'source_unavailable',
            `URL source returned HTTP ${status}`,
            true
          )
        );
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        fail(new UrlSourceFetchError('source_unavailable', `URL source returned HTTP ${status}`));
        return;
      }

      const contentLength = parseContentLength(response.headers);
      if (contentLength != null && contentLength > MAX_URL_SOURCE_BYTES) {
        response.resume();
        fail(
          new UrlSourceFetchError(
            'source_too_large',
            `URL source exceeds the ${MAX_URL_SOURCE_BYTES} byte limit`
          )
        );
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', chunk => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.byteLength;
        if (size > MAX_URL_SOURCE_BYTES) {
          response.destroy();
          fail(
            new UrlSourceFetchError(
              'source_too_large',
              `URL source exceeds the ${MAX_URL_SOURCE_BYTES} byte limit`
            )
          );
          return;
        }
        chunks.push(buffer);
      });
      response.once('error', fail);
      response.once('end', () => {
        finish(() =>
          resolve({
            response: {
              content: Buffer.concat(chunks).toString('utf8'),
              mediaType: headerValue(response.headers, 'content-type'),
              sourceRevision:
                headerValue(response.headers, 'etag') ??
                headerValue(response.headers, 'last-modified')
            }
          })
        );
      });
    });

    request.setTimeout(URL_SOURCE_TIMEOUT_MS, () => {
      request.destroy(
        new UrlSourceFetchError('source_timeout', 'URL source request timed out', true)
      );
    });
    request.once('error', fail);
    request.end();
  });
};

export const fetchUrlSource = async (
  value: string,
  signal: AbortSignal
): Promise<UrlSourceFetchResult> => {
  let url = validateRemoteFetchUrl(value);
  for (let redirectCount = 0; redirectCount <= MAX_URL_SOURCE_REDIRECTS; redirectCount++) {
    const result = await requestUrl(url, signal);
    if ('response' in result) return result.response;
    if (redirectCount === MAX_URL_SOURCE_REDIRECTS) {
      throw new UrlSourceFetchError('invalid_source', 'URL source exceeded the redirect limit');
    }
    try {
      url = validateRemoteFetchUrl(new URL(result.redirect, url));
    } catch (error) {
      if (error instanceof UrlSourceFetchError) throw error;
      throw new UrlSourceFetchError('invalid_source', 'URL source returned an invalid redirect');
    }
  }
  throw new UrlSourceFetchError('invalid_source', 'URL source could not be fetched');
};
