import { describe, test, expect, beforeEach } from 'vitest';
import { setTranslations, $t, $tRef } from './localize';

describe('localize', () => {
  beforeEach(() => {
    // Reset translations before each test
    setTranslations({});
  });

  describe('setTranslations', () => {
    test('should set translation dictionary', () => {
      setTranslations({
        'app.welcome': 'Welcome to Diagram Craft',
        'app.save': 'Save'
      });

      expect($t('app.welcome', 'fallback')).toBe('Welcome to Diagram Craft');
      expect($t('app.save', 'fallback')).toBe('Save');
    });

    test('should replace existing translations', () => {
      setTranslations({ 'app.test': 'First' });
      expect($t('app.test', 'fallback')).toBe('First');

      setTranslations({ 'app.test': 'Second' });
      expect($t('app.test', 'fallback')).toBe('Second');
    });
  });

  describe('$t with id and message', () => {
    test('should return translation when available', () => {
      setTranslations({ 'greeting': 'Hello' });

      expect($t('greeting', 'Hi')).toBe('Hello');
    });

    test('should return fallback message when translation not found', () => {
      setTranslations({});

      expect($t('missing.key', 'Fallback Message')).toBe('Fallback Message');
    });

    test('should handle empty translation dictionary', () => {
      expect($t('any.key', 'Default')).toBe('Default');
    });

    test('should handle special characters in translations', () => {
      setTranslations({ 'special': 'Hello "World" & <Friends>' });

      expect($t('special', 'fallback')).toBe('Hello "World" & <Friends>');
    });
  });

  describe('$tRef', () => {
    test('should create TranslationRef object', () => {
      const ref = $tRef('app.title', 'Diagram Craft');

      expect(ref).toEqual({
        id: 'app.title',
        message: 'Diagram Craft'
      });
    });

    test('should create multiple independent refs', () => {
      const ref1 = $tRef('key1', 'Message 1');
      const ref2 = $tRef('key2', 'Message 2');

      expect(ref1.id).toBe('key1');
      expect(ref2.id).toBe('key2');
      expect(ref1.message).toBe('Message 1');
      expect(ref2.message).toBe('Message 2');
    });
  });

  describe('$t with TranslationRef', () => {
    test('should return translation when available', () => {
      setTranslations({ 'app.welcome': 'Welcome Back' });
      const ref = $tRef('app.welcome', 'Welcome');

      expect($t(ref)).toBe('Welcome Back');
    });

    test('should return fallback message when translation not found', () => {
      setTranslations({});
      const ref = $tRef('missing.key', 'Default Message');

      expect($t(ref)).toBe('Default Message');
    });

    test('should work with stored refs', () => {
      const SAVE_ACTION = $tRef('action.save', 'Save');
      const CANCEL_ACTION = $tRef('action.cancel', 'Cancel');

      setTranslations({
        'action.save': 'Speichern',
        'action.cancel': 'Abbrechen'
      });

      expect($t(SAVE_ACTION)).toBe('Speichern');
      expect($t(CANCEL_ACTION)).toBe('Abbrechen');
    });
  });

  describe('mixed usage', () => {
    test('should handle both ref and direct calls with same translations', () => {
      setTranslations({ 'common.ok': 'OK' });

      const ref = $tRef('common.ok', 'Okay');

      expect($t(ref)).toBe('OK');
      expect($t('common.ok', 'Okay')).toBe('OK');
    });

    test('should handle updates to translations affecting both call styles', () => {
      const ref = $tRef('dynamic', 'Original');

      setTranslations({ 'dynamic': 'First Translation' });
      expect($t(ref)).toBe('First Translation');
      expect($t('dynamic', 'Original')).toBe('First Translation');

      setTranslations({ 'dynamic': 'Second Translation' });
      expect($t(ref)).toBe('Second Translation');
      expect($t('dynamic', 'Original')).toBe('Second Translation');
    });
  });

  describe('edge cases', () => {
    test('should handle empty strings', () => {
      setTranslations({ '': 'Empty key' });

      expect($t('', 'fallback')).toBe('Empty key');
    });

    test('should handle translation value as empty string', () => {
      setTranslations({ 'empty.value': '' });

      expect($t('empty.value', 'fallback')).toBe('');
    });

    test('should handle dot-separated nested keys', () => {
      setTranslations({
        'app.menu.file.open': 'Open File',
        'app.menu.file.save': 'Save File'
      });

      expect($t('app.menu.file.open', 'Open')).toBe('Open File');
      expect($t('app.menu.file.save', 'Save')).toBe('Save File');
    });
  });
});
