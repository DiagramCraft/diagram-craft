import { request as httpRequest, type IncomingHttpHeaders, type RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import {
  resolvePublicOutboundHost,
  type ResolvedOutboundAddress,
  UnsafeOutboundHostError
} from '../../utils/outboundUrlSafety';

const REQUEST_TIMEOUT_MS = 10_000;

export type WebhookRequestResult = {
  status: number;
  retryAfter: string | null;
};

const isDevelopment = () => process.env['NODE_ENV'] === 'development';

const headerValue = (headers: IncomingHttpHeaders, name: string) => {
  const value = headers[name];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
};

export const sendWebhookRequest = async (
  url: URL,
  options: { body: string; headers: Record<string, string>; signal: AbortSignal }
): Promise<WebhookRequestResult> => {
  let addresses: ResolvedOutboundAddress[] | undefined;
  if (!isDevelopment()) {
    addresses = await resolvePublicOutboundHost(
      url.hostname,
      'Webhook URL host must be publicly routable'
    );
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const firstAddress = addresses?.[0];
  const requestOptions: RequestOptions = {
    protocol: url.protocol,
    hostname,
    port: url.port || undefined,
    path: `${url.pathname}${url.search}`,
    method: 'POST',
    headers: options.headers,
    signal: options.signal
  };

  if (firstAddress) {
    requestOptions.lookup = (_hostname, _options, callback) => {
      callback(null, firstAddress.address, firstAddress.family);
    };
  }

  if (url.protocol === 'https:' && isIP(hostname) === 0) {
    (requestOptions as RequestOptions & { servername?: string }).servername = hostname;
  }

  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      requestOptions,
      response => {
        response.resume();
        resolve({
          status: response.statusCode ?? 0,
          retryAfter: headerValue(response.headers, 'retry-after')
        });
      }
    );
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('Webhook request timed out'));
    });
    request.once('error', reject);
    request.end(options.body);
  });
};

export { UnsafeOutboundHostError };
