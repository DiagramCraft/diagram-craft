import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types';
import { UserDbResult } from '../domain/auth/db/authDatabase';

const getSecret = (): string => {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return secret;
};

const getExpiry = (type: 'access' | 'refresh'): string => {
  if (type === 'access') {
    return process.env['JWT_ACCESS_TOKEN_EXPIRY'] ?? '1h';
  }
  return process.env['JWT_REFRESH_TOKEN_EXPIRY'] ?? '7d';
};

export const parseExpiryToSeconds = (expiry: string): number => {
  const match = expiry.match(/^(\d+)(s|m|h|d)$/);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Invalid JWT expiry '${expiry}'; expected a value such as 15m, 1h, or 7d`);
  }
  const value = parseInt(match[1], 10);
  if (value <= 0) {
    throw new Error(`Invalid JWT expiry '${expiry}'; duration must be greater than zero`);
  }
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      throw new Error(`Invalid JWT expiry '${expiry}'`);
  }
};

export const getTokenExpirySeconds = (type: 'access' | 'refresh'): number =>
  parseExpiryToSeconds(getExpiry(type));

export const generateAccessToken = (user: UserDbResult): string => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email ?? undefined,
    name: user.display_name,
    provider: user.auth_provider,
    type: 'access'
  };

  return jwt.sign(payload, getSecret(), {
    expiresIn: getTokenExpirySeconds('access')
  });
};

export const generateRefreshToken = (user: UserDbResult): string => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email ?? undefined,
    name: user.display_name,
    provider: user.auth_provider,
    type: 'refresh'
  };

  return jwt.sign(payload, getSecret(), {
    expiresIn: getTokenExpirySeconds('refresh')
  });
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as JWTPayload;
  } catch (_error) {
    throw new Error('Invalid or expired token');
  }
};

export const generateTokenPair = (user: UserDbResult) => {
  return {
    access_token: generateAccessToken(user),
    refresh_token: generateRefreshToken(user),
    token_type: 'Bearer',
    expires_in: getTokenExpirySeconds('access')
  };
};
