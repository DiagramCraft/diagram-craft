import argon2 from 'argon2';
import type { PasswordHasher } from './authServices';

export const argon2PasswordHasher: PasswordHasher = {
  dummyHash:
    '$argon2id$v=19$m=65536,t=3,p=4$Px/0E4/Uidg2/8aJ6c08zA$bYyBAz45tuMYV2oXsOeQzlXH1WMNAApkAxtr8wR9pJo',

  hash: password =>
    argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3, // 3 iterations
      parallelism: 4 // 4 threads
    }),

  verify: async (hash, password) => {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
};
