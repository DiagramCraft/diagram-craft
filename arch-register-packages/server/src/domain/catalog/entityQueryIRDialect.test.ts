import { describe, expect, it } from 'vitest';
import { createEntityQueryDialectAdapter } from './entityQueryIRDialect';

describe('EntityQueryDialectAdapter.nowDateLiteral', () => {
  describe('postgres', () => {
    const adapter = createEntityQueryDialectAdapter('postgres');

    it('renders today with no offset', () => {
      expect(adapter.nowDateLiteral()).toBe(
        `to_char((NOW() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`
      );
      expect(adapter.nowDateLiteral(0)).toBe(
        `to_char((NOW() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`
      );
    });

    it('renders a positive offset', () => {
      expect(adapter.nowDateLiteral(30)).toBe(
        `to_char((NOW() AT TIME ZONE 'UTC')::date + INTERVAL '30 days', 'YYYY-MM-DD')`
      );
    });

    it('renders a negative offset', () => {
      expect(adapter.nowDateLiteral(-7)).toBe(
        `to_char((NOW() AT TIME ZONE 'UTC')::date + INTERVAL '-7 days', 'YYYY-MM-DD')`
      );
    });
  });

  describe('sqlite', () => {
    const adapter = createEntityQueryDialectAdapter('sqlite');

    it('renders today with no offset', () => {
      expect(adapter.nowDateLiteral()).toBe(`date('now')`);
      expect(adapter.nowDateLiteral(0)).toBe(`date('now')`);
    });

    it('renders a positive offset', () => {
      expect(adapter.nowDateLiteral(30)).toBe(`date('now', '+30 days')`);
    });

    it('renders a negative offset', () => {
      expect(adapter.nowDateLiteral(-7)).toBe(`date('now', '-7 days')`);
    });
  });
});
