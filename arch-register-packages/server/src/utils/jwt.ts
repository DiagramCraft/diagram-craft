import type { JWTPayload } from '../types';
import type { UserDbResult } from '../domain/auth/db/authDatabase';
import { getAuthServices } from '../auth/authServices';
import type { TokenType } from '../auth/authServices';

export const getTokenExpirySeconds = (type: TokenType): number =>
  getAuthServices().tokenService.expirySeconds(type);

const claimsFor = (user: UserDbResult, type: TokenType) => ({
  sub: user.id,
  email: user.email ?? undefined,
  name: user.display_name,
  provider: user.auth_provider,
  type
});

export const generateAccessToken = (user: UserDbResult): string =>
  getAuthServices().tokenService.sign(claimsFor(user, 'access'));

export const generateRefreshToken = (user: UserDbResult): string =>
  getAuthServices().tokenService.sign({
    ...claimsFor(user, 'refresh'),
    jti: globalThis.crypto.randomUUID()
  });

export const verifyToken = (token: string): JWTPayload =>
  getAuthServices().tokenService.verify(token);

export const generateTokenPair = (user: UserDbResult) => ({
  access_token: generateAccessToken(user),
  refresh_token: generateRefreshToken(user),
  token_type: 'Bearer',
  expires_in: getTokenExpirySeconds('access')
});
