import type { H3Event } from 'h3';

/**
 * Number of trusted reverse-proxy hops (TRUST_PROXY). 0 means forwarding headers are ignored.
 */
const getTrustedProxyHops = () => {
  const raw = process.env['TRUST_PROXY'];
  if (raw == null || raw.trim() === '') return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const resolveClientIp = (
  socketAddress: string | undefined,
  forwardedFor: string | null | undefined,
  trustedHops: number
): string | null => {
  if (trustedHops > 0 && forwardedFor) {
    const hops = forwardedFor
      .split(',')
      .map(part => part.trim())
      .filter(part => part.length > 0);
    // The Nth entry from the right was appended by the outermost trusted proxy
    const candidate = hops[Math.max(hops.length - trustedHops, 0)];
    if (candidate) return candidate;
  }
  return socketAddress ?? null;
};

export const getClientIp = (event: H3Event): string | null => {
  const socketAddress = (
    event as unknown as {
      runtime?: { node?: { req?: { socket?: { remoteAddress?: string } } } };
    }
  ).runtime?.node?.req?.socket?.remoteAddress;
  return resolveClientIp(
    socketAddress,
    event.req.headers.get('x-forwarded-for'),
    getTrustedProxyHops()
  );
};
