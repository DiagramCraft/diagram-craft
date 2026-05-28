import { Issuer, Client, generators } from 'openid-client';

let cachedClient: Client | null = null;

export const getOidcClient = async (): Promise<Client> => {
  if (cachedClient) return cachedClient;

  const issuerUrl = process.env['OIDC_ISSUER'];
  const clientId = process.env['OIDC_CLIENT_ID'];
  const clientSecret = process.env['OIDC_CLIENT_SECRET'];
  const redirectUri = process.env['OIDC_REDIRECT_URI'];

  if (!issuerUrl || !clientId || !clientSecret || !redirectUri) {
    throw new Error('OIDC configuration incomplete');
  }

  const issuer = await Issuer.discover(issuerUrl);
  cachedClient = new issuer.Client({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: [redirectUri],
    response_types: ['code']
  });

  return cachedClient;
};

export const generateAuthUrl = async (): Promise<{
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}> => {
  const client = await getOidcClient();
  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  const scope = process.env['OIDC_SCOPE'] ?? 'openid profile email';

  const url = client.authorizationUrl({
    scope,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  return { url, state, nonce, codeVerifier };
};

export const handleCallback = async (
  callbackParams: Record<string, string>,
  state: string,
  nonce: string,
  codeVerifier: string
) => {
  const client = await getOidcClient();
  const redirectUri = process.env['OIDC_REDIRECT_URI']!;

  const tokenSet = await client.callback(redirectUri, callbackParams, {
    state,
    nonce,
    code_verifier: codeVerifier
  });

  const claims = tokenSet.claims();

  return {
    sub: claims.sub,
    email: claims.email,
    name: claims.name ?? claims.preferred_username ?? claims.email ?? claims.sub,
    issuer: claims.iss
  };
};
