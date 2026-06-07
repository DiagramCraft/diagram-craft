import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthCookies, setAuthCookies } from './cookies.js';

vi.mock('h3', () => ({
  setCookie: vi.fn()
}));

import { setCookie } from 'h3';

const mockSetCookie = vi.mocked(setCookie);

const mockEvent = {} as Parameters<typeof setAuthCookies>[0];

beforeEach(() => {
  mockSetCookie.mockClear();
  delete process.env['NODE_ENV'];
});

describe('setAuthCookies', () => {
  it('sets access and refresh tokens with correct names and values', () => {
    setAuthCookies(mockEvent, 'access-tok', 'refresh-tok', 900);

    expect(mockSetCookie).toHaveBeenCalledTimes(2);
    expect(mockSetCookie).toHaveBeenCalledWith(mockEvent, 'ar_access_token', 'access-tok', expect.any(Object));
    expect(mockSetCookie).toHaveBeenCalledWith(mockEvent, 'ar_refresh_token', 'refresh-tok', expect.any(Object));
  });

  it('sets access token options correctly', () => {
    setAuthCookies(mockEvent, 'access-tok', 'refresh-tok', 900);

    const accessCall = mockSetCookie.mock.calls[0];
    expect(accessCall).toBeDefined();
    const [, , , accessOpts] = accessCall!;
    expect(accessOpts).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 900
    });
  });

  it('sets refresh token with 7-day maxAge and scoped path', () => {
    setAuthCookies(mockEvent, 'access-tok', 'refresh-tok', 900);

    const refreshCall = mockSetCookie.mock.calls[1];
    expect(refreshCall).toBeDefined();
    const [, , , refreshOpts] = refreshCall!;
    expect(refreshOpts).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 3600
    });
  });

  it('sets secure=false outside production', () => {
    process.env['NODE_ENV'] = 'development';
    setAuthCookies(mockEvent, 'a', 'r', 60);

    for (const call of mockSetCookie.mock.calls) {
      expect(call[3]).toMatchObject({ secure: false });
    }
  });

  it('sets secure=true in production', () => {
    process.env['NODE_ENV'] = 'production';
    setAuthCookies(mockEvent, 'a', 'r', 60);

    for (const call of mockSetCookie.mock.calls) {
      expect(call[3]).toMatchObject({ secure: true });
    }
  });
});

describe('clearAuthCookies', () => {
  it('clears both cookies by setting empty values and maxAge 0', () => {
    clearAuthCookies(mockEvent);

    expect(mockSetCookie).toHaveBeenCalledTimes(2);
    expect(mockSetCookie).toHaveBeenCalledWith(mockEvent, 'ar_access_token', '', expect.objectContaining({ maxAge: 0 }));
    expect(mockSetCookie).toHaveBeenCalledWith(
      mockEvent,
      'ar_refresh_token',
      '',
      expect.objectContaining({ maxAge: 0 })
    );
  });

  it('preserves correct paths when clearing', () => {
    clearAuthCookies(mockEvent);

    const accessCall = mockSetCookie.mock.calls.find(c => c[1] === 'ar_access_token');
    const refreshCall = mockSetCookie.mock.calls.find(c => c[1] === 'ar_refresh_token');

    expect(accessCall?.[3]).toMatchObject({ path: '/' });
    expect(refreshCall?.[3]).toMatchObject({ path: '/api/auth/refresh' });
  });
});
