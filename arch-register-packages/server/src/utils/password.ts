import { getAuthServices } from '../auth/authServices';

export const hashPassword = (password: string): Promise<string> =>
  getAuthServices().passwordHasher.hash(password);

export const verifyPassword = (hash: string, password: string): Promise<boolean> =>
  getAuthServices().passwordHasher.verify(hash, password);

export const getDummyPasswordHash = (): string => getAuthServices().passwordHasher.dummyHash;
