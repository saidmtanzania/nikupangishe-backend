import type { Request, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'nkp_access_token';
export const REFRESH_TOKEN_COOKIE = 'nkp_refresh_token';

export function readCookieHeader(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;

  const entry = header.split(';').find((part) => {
    const separator = part.indexOf('=');
    return separator >= 0 && part.slice(0, separator).trim() === name;
  });
  if (!entry) return undefined;

  const separator = entry.indexOf('=');
  return decodeURIComponent(entry.slice(separator + 1).trim());
}

export function readCookie(request: Request, name: string): string | undefined {
  return readCookieHeader(request.headers.cookie, name);
}

export function setAuthCookies(
  response: Response,
  accessToken: string,
  refreshToken: string,
  secure: boolean,
): void {
  const options = {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
  };
  response.cookie(ACCESS_TOKEN_COOKIE, accessToken, options);
  response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, options);
}

export function clearAuthCookies(response: Response): void {
  const options = { httpOnly: true, sameSite: 'lax' as const, path: '/' };
  response.clearCookie(ACCESS_TOKEN_COOKIE, options);
  response.clearCookie(REFRESH_TOKEN_COOKIE, options);
}
