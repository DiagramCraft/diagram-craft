import type { IncomingMessage } from 'node:http';

export const isApiToken = (token: string) => token.startsWith('ar_pat_');

export const requestToken = (request: IncomingMessage) => {
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return isApiToken(token) ? token : null;
};
