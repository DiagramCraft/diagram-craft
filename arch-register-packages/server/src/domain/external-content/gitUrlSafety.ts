import { assertPublicOutboundHost } from '../../utils/outboundUrlSafety';

export const assertSafeGitUrl = async (value: string) => {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error('Git source URLs must use HTTPS');
  }
  if (url.username || url.password) throw new Error('Git source URLs must not contain credentials');
  if (url.port && url.port !== '443') throw new Error('Git source URLs must use HTTPS port 443');
  await assertPublicOutboundHost(url.hostname, 'Git source host must be publicly routable');
};
