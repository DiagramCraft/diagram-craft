import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type ResolvedOutboundAddress = {
  address: string;
  family: 4 | 6;
};

export class UnsafeOutboundHostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeOutboundHostError';
  }
}

const isPrivateIpv4 = (address: string) => {
  const octets = address.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)
  )
    return true;
  const first = octets[0]!;
  const second = octets[1]!;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && second >= 18 && second <= 19) ||
    first >= 224
  );
};

export const isPrivateIpAddress = (address: string): boolean => {
  const normalized = address.toLowerCase().split('%')[0] ?? '';
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff')
  )
    return true;
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
};

const normalizedHostname = (hostname: string) => hostname.replace(/^\[|\]$/g, '').toLowerCase();

const isLocalHostname = (hostname: string) =>
  !hostname ||
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname.endsWith('.local');

export const resolvePublicOutboundHost = async (
  hostname: string,
  message: string
): Promise<ResolvedOutboundAddress[]> => {
  const normalized = normalizedHostname(hostname);
  if (isLocalHostname(normalized)) throw new UnsafeOutboundHostError(message);

  const addressType = isIP(normalized);
  const addresses = addressType
    ? [{ address: normalized, family: addressType as 4 | 6 }]
    : await lookup(normalized, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some(address => isPrivateIpAddress(address.address))) {
    throw new UnsafeOutboundHostError(message);
  }

  return addresses.map(address => ({
    address: address.address,
    family: address.family as 4 | 6
  }));
};

export const assertPublicOutboundHost = async (hostname: string, message: string) => {
  await resolvePublicOutboundHost(hostname, message);
};
