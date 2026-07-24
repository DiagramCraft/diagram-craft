import * as client from 'openid-client';

let cachedConfig: client.Configuration | null = null;

const getOidcConfig = async (): Promise<client.Configuration> => {
  if (cachedConfig) return cachedConfig;

  const issuerUrl = process.env['OIDC_ISSUER'];
  const clientId = process.env['OIDC_CLIENT_ID'];
  const clientSecret = process.env['OIDC_CLIENT_SECRET'];

  if (!issuerUrl || !clientId || !clientSecret) {
    throw new Error('OIDC configuration incomplete');
  }

  cachedConfig = await client.discovery(new URL(issuerUrl), clientId, clientSecret);

  return cachedConfig;
};

export const generateAuthUrl = async (): Promise<{
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}> => {
  const config = await getOidcConfig();
  const redirectUri = process.env['OIDC_REDIRECT_URI'];

  if (!redirectUri) {
    throw new Error('OIDC_REDIRECT_URI not configured');
  }

  const state = client.randomState();
  const nonce = client.randomNonce();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

  const scope = process.env['OIDC_SCOPE'] ?? 'openid profile email';

  const parameters: Record<string, string> = {
    redirect_uri: redirectUri,
    scope,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  };

  const authUrl = client.buildAuthorizationUrl(config, parameters);

  return {
    url: authUrl.href,
    state,
    nonce,
    codeVerifier
  };
};

export const handleCallback = async (
  callbackUrl: string,
  state: string,
  nonce: string,
  codeVerifier: string
) => {
  const config = await getOidcConfig();

  const tokens = await client.authorizationCodeGrant(config, new URL(callbackUrl), {
    pkceCodeVerifier: codeVerifier,
    expectedState: state,
    expectedNonce: nonce
  });

  const claims = tokens.claims();

  if (!claims) {
    throw new Error('No ID token returned by authorization server');
  }

  return {
    sub: claims.sub,
    email: claims.email as string | undefined,
    name: (claims.name ?? claims.preferred_username ?? claims.email ?? claims.sub) as string,
    issuer: claims.iss
  };
};
