import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

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

const isPrivateIp = (address: string): boolean => {
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

export const assertSafeGitUrl = async (value: string) => {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error('Git source URLs must use HTTPS');
  }
  if (url.username || url.password) throw new Error('Git source URLs must not contain credentials');
  if (url.port && url.port !== '443') throw new Error('Git source URLs must use HTTPS port 443');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    throw new Error('Git source host must be publicly routable');
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(address => isPrivateIp(address.address))) {
    throw new Error('Git source host must be publicly routable');
  }
};
