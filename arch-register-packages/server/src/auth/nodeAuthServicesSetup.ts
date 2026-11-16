// Side-effect module: registers the Node auth implementations (argon2 + jsonwebtoken).
// Imported via nodeSetup.ts; do not import directly from entry points.
import { configureAuthServices } from './authServices';
import { argon2PasswordHasher } from './argon2PasswordHasher';
import { jsonwebtokenTokenService } from './jsonwebtokenTokenService';

configureAuthServices({
  passwordHasher: argon2PasswordHasher,
  tokenService: jsonwebtokenTokenService
});
