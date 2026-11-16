import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types';
import { parseExpiryToSeconds } from './expiry';
import type { TokenService, TokenType } from './authServices';

const getSecret = (): string => {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return secret;
};

const getExpiry = (type: TokenType): string =>
  type === 'access'
    ? (process.env['JWT_ACCESS_TOKEN_EXPIRY'] ?? '1h')
    : (process.env['JWT_REFRESH_TOKEN_EXPIRY'] ?? '7d');

const expirySeconds = (type: TokenType) => parseExpiryToSeconds(getExpiry(type));

export const jsonwebtokenTokenService: TokenService = {
  expirySeconds,

  sign: claims => jwt.sign(claims, getSecret(), { expiresIn: expirySeconds(claims.type) }),

  verify: token => {
    try {
      return jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as JWTPayload;
    } catch (_error) {
      throw new Error('Invalid or expired token');
    }
  }
};
