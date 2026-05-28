import type { H3Event } from 'h3';
import { setCookie } from 'h3';

const isProduction = () => process.env['NODE_ENV'] === 'production';

export const setAuthCookies = (
  event: H3Event,
  accessToken: string,
  refreshToken: string,
  accessExpiresIn: number
) => {
  const secure = isProduction();

  setCookie(event, 'ar_access_token', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api',
    maxAge: accessExpiresIn
  });

  setCookie(event, 'ar_refresh_token', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 3600
  });
};

export const clearAuthCookies = (event: H3Event) => {
  const secure = isProduction();

  setCookie(event, 'ar_access_token', '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api',
    maxAge: 0
  });

  setCookie(event, 'ar_refresh_token', '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 0
  });
};
