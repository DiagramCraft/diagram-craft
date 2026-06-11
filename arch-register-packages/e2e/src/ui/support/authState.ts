import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seededUser } from './users';

const supportDir = dirname(fileURLToPath(import.meta.url));
const e2ePackageDir = resolve(supportDir, '../../..');

export const authStateDir = resolve(e2ePackageDir, '.auth');
export const seededUserAuthStatePath = resolve(authStateDir, `${seededUser.email}.json`);
