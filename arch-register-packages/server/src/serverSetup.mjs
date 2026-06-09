/**
 * Registers the serverLoader hooks using the modern module.register() API.
 * This must be imported AFTER tsx so that our hooks are registered last and
 * therefore run first (LIFO order), giving us a chance to intercept Vite-specific
 * imports (*.css?inline, *.yaml, etc.) before tsx sees them.
 */
import { register } from 'node:module';

register('./serverLoader.mjs', import.meta.url);
