import { describe, expect, test } from 'vitest';
import { assert, is } from './assert';

describe('assert', () => {
  describe('assert', () => {
    test('assert.present', () => {
      assert.present(1);
      assert.present([]);
      assert.present({});

      try {
        assert.present(null);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.present(false);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.present(undefined);
        expect.fail();
      } catch (e) {
        // Ignore
      }
    });

    test('assert.false', () => {
      assert.false(false);

      try {
        assert.false(true);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.false(1);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.false(null);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.false(undefined);
        expect.fail();
      } catch (e) {
        // Ignore
      }
    });

    test('assert.true', () => {
      assert.true(true);

      try {
        assert.true(false);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.true(1);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.true(null);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.true(undefined);
        expect.fail();
      } catch (e) {
        // Ignore
      }
    });

    test('assert.fail', () => {
      try {
        assert.fail();
        expect.fail();
      } catch (e) {
        // Ignore
      }
    });

    test('assert.notPresent', () => {
      assert.notPresent(undefined);
      assert.notPresent(null);

      try {
        assert.notPresent(1);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.notPresent(false);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.notPresent([]);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.notPresent({});
        expect.fail();
      } catch (e) {
        // Ignore
      }
    });

    test('assert.arrayNotEmpty', () => {
      assert.arrayNotEmpty([1]);
      assert.arrayNotEmpty([1, 2]);
      assert.arrayNotEmpty([1, 2, 3]);

      try {
        assert.arrayNotEmpty([]);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.arrayNotEmpty(null);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.arrayNotEmpty(undefined);
        expect.fail();
      } catch (e) {
        // Ignore
      }
    });

    test('assert.arrayWithExactlyOneElement', () => {
      assert.arrayWithExactlyOneElement([1]);

      try {
        assert.arrayWithExactlyOneElement([]);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.arrayWithExactlyOneElement([1, 2]);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.arrayWithExactlyOneElement(null);
        expect.fail();
      } catch (e) {
        // Ignore
      }

      try {
        assert.arrayWithExactlyOneElement(undefined);
        expect.fail();
      } catch (e) {
        // Ignore
      }
    });
  });

  describe('is', () => {
    test('is.present', () => {
      expect(is.present(1)).toBe(true);
      expect(is.present([])).toBe(true);
      expect(is.present({})).toBe(true);
      expect(is.present(null)).toBe(false);
      expect(is.present(false)).toBe(true);
      expect(is.present(undefined)).toBe(false);
    });

    test('is.notPresent', () => {
      expect(is.notPresent(1)).toBe(false);
      expect(is.notPresent([])).toBe(false);
      expect(is.notPresent({})).toBe(false);
      expect(is.notPresent(null)).toBe(true);
      expect(is.notPresent(false)).toBe(false);
      expect(is.notPresent(undefined)).toBe(true);
    });

    test('is.arrayWithExactlyOneElement', () => {
      expect(is.arrayWithExactlyOneElement([1])).toBe(true);
      expect(is.arrayWithExactlyOneElement([])).toBe(false);
      expect(is.arrayWithExactlyOneElement([1, 2])).toBe(false);
      expect(is.arrayWithExactlyOneElement(null)).toBe(false);
      expect(is.arrayWithExactlyOneElement(undefined)).toBe(false);
    });

    test('is.arrayNotEmpty', () => {
      expect(is.arrayNotEmpty([1])).toBe(true);
      expect(is.arrayNotEmpty([1, 2])).toBe(true);
      expect(is.arrayNotEmpty([])).toBe(false);
      expect(is.arrayNotEmpty(null)).toBe(false);
      expect(is.arrayNotEmpty(undefined)).toBe(false);
    });

    test('is.true', () => {
      expect(is.true(true)).toBe(true);
      expect(is.true(false)).toBe(false);
      expect(is.true(1)).toBe(false);
      expect(is.true(null)).toBe(false);
      expect(is.true(undefined)).toBe(false);
    });

    test('is.false', () => {
      expect(is.false(false)).toBe(true);
      expect(is.false(true)).toBe(false);
      expect(is.false(1)).toBe(false);
      expect(is.false(null)).toBe(false);
      expect(is.false(undefined)).toBe(false);
    });
  });
});
