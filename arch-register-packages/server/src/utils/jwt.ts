import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types';
import { UserRow } from '@arch-register/server/domain/auth/db/authDatabase';

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
  if (!match?.[1] || !match[2]) return 3600;
  const value = parseInt(match[1], 10);
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
      return 3600;
  }
};

export const generateAccessToken = (user: UserRow): string => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email ?? undefined,
    name: user.display_name,
    provider: user.auth_provider,
    type: 'access'
  };

  return jwt.sign(payload, getSecret(), {
    expiresIn: parseExpiryToSeconds(getExpiry('access'))
  });
};

export const generateRefreshToken = (user: UserRow): string => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email ?? undefined,
    name: user.display_name,
    provider: user.auth_provider,
    type: 'refresh'
  };

  return jwt.sign(payload, getSecret(), {
    expiresIn: parseExpiryToSeconds(getExpiry('refresh'))
  });
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, getSecret()) as JWTPayload;
  } catch (_error) {
    throw new Error('Invalid or expired token');
  }
};

export const generateTokenPair = (user: UserRow) => {
  return {
    access_token: generateAccessToken(user),
    refresh_token: generateRefreshToken(user),
    token_type: 'Bearer',
    expires_in: parseExpiryToSeconds(getExpiry('access'))
  };
};
