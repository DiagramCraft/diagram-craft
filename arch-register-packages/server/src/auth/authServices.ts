import type { JWTPayload } from '../types';

export type TokenType = 'access' | 'refresh';

export type TokenClaims = Omit<JWTPayload, 'iat' | 'exp'>;

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  /** A well-formed hash that never matches; verified against to keep login timing constant. */
  readonly dummyHash: string;
}

export interface TokenService {
  sign(claims: TokenClaims): string;
  /** Throws if the token is invalid or expired. */
  verify(token: string): JWTPayload;
  expirySeconds(type: TokenType): number;
}

export type AuthServices = {
  passwordHasher: PasswordHasher;
  tokenService: TokenService;
};

let configured: AuthServices | undefined;

/**
 * Selects the password hashing and token implementations. Must be called once at startup
 * (see nodeAuthServicesSetup.ts for Node, demoAuthServices.ts for the browser demo).
 */
export const configureAuthServices = (services: AuthServices) => {
  configured = services;
};

export const getAuthServices = (): AuthServices => {
  if (!configured) {
    throw new Error('Auth services are not configured; call configureAuthServices() at startup');
  }
  return configured;
};
