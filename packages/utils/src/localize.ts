/**
 * Internationalization utilities for managing translations in the application.
 * Provides functions to set, reference, and retrieve translated strings.
 *
 * @module
 */

import { mustExist } from './assert';

/**
 * Internal storage for translation mappings from translation IDs to localized strings.
 */
let TRANSLATIONS: Record<string, string> = {};

/**
 * Sets the translation dictionary for the application.
 * This should be called once during application initialization with the appropriate locale data.
 *
 * @param translations - A dictionary mapping translation IDs to localized strings
 *
 * @example
 * ```ts
 * setTranslations({
 *   'app.welcome': 'Welcome to Diagram Craft',
 *   'app.save': 'Save'
 * });
 * ```
 */
export const setTranslations = (translations: Record<string, string>) => {
  TRANSLATIONS = translations;
};

/**
 * Represents a translatable string with an ID and a fallback message.
 * Used to create translatable strings outside of React components that
 * will then be translated on demand when rendered
 */
export type TranslatedString = {
  /** Unique identifier for the translation */
  id: string;
  /** Default message to use if translation is not found */
  message: string;
};

/**
 * Creates a translation reference object that can be used for deferred translation lookups.
 * Useful for storing translation references in constants or passing them as props.
 *
 * @param id - The unique translation identifier
 * @param message - The default message in the source language
 * @returns A TranslationRef object containing the id and message
 *
 * @example
 * ```ts
 * const WELCOME_MSG = $tRef('app.welcome', 'Welcome');
 * // Later:
 * const translated = $t(WELCOME_MSG);
 * ```
 */
export const $tStr = (id: string, message: string) => {
  return { id, message };
};

/**
 * Translates a string using a TranslationRef object.
 * Returns the translated string if available, otherwise returns the fallback message.
 *
 * @param translation - A TranslationRef object containing the translation ID and fallback message
 * @returns The translated string or the fallback message
 */
function t(translation: TranslatedString): string;

/**
 * Translates a string using a translation ID and fallback message.
 * Returns the translated string if available, otherwise returns the fallback message.
 *
 * @param id - The unique translation identifier
 * @param message - The default message to use if translation is not found
 * @returns The translated string or the fallback message
 */
function t(id: string, message: string): string;

/**
 * Internal implementation of the translation function.
 * Supports both TranslationRef objects and direct id/message pairs.
 *
 * @internal
 */
function t(obj: unknown, message?: string): string {
  if (typeof obj === 'string') {
    return TRANSLATIONS[obj] ?? mustExist(message);
  } else {
    const ref = obj as TranslatedString;
    return TRANSLATIONS[ref.id] ?? ref.message;
  }
}

/**
 * Main translation function for the application.
 * Can be used with either a TranslationRef object or direct id/message parameters.
 *
 * @example
 * Using with id and message:
 * ```ts
 * const text = $t('app.welcome', 'Welcome to Diagram Craft');
 * ```
 *
 * @example
 * Using with TranslationRef:
 * ```ts
 * const ref = $tRef('app.welcome', 'Welcome');
 * const text = $t(ref);
 * ```
 */
export const $t = t;
