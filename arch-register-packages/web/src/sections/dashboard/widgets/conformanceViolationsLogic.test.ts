import { describe, expect, it } from 'vitest';
import { groupViolationsByEntity, type ViolationLike } from './conformanceViolationsLogic';

const v = (
  entity_id: string,
  check_id: string,
  severity: 'error' | 'warning' = 'warning',
  entity_name: string | null = entity_id
): ViolationLike => ({ entity_id, entity_name, check_id, severity, message: `m-${check_id}` });

describe('groupViolationsByEntity', () => {
  it('groups by entity and ranks errors, then violation count, then name', () => {
    const { entities, total } = groupViolationsByEntity(
      [v('b', 'c1'), v('b', 'c2'), v('a', 'c1'), v('c', 'c1', 'error')],
      { limit: 10 }
    );
    expect(total).toBe(3);
    expect(entities.map(e => e.entityId)).toEqual(['c', 'b', 'a']);
    expect(entities[1]!.messages).toEqual(['m-c1', 'm-c2']);
  });

  it('escalates severity when any violation is an error', () => {
    const { entities } = groupViolationsByEntity([v('a', 'c1'), v('a', 'c2', 'error')], {
      limit: 5
    });
    expect(entities[0]!.worstSeverity).toBe('error');
  });

  it('filters by check id and applies the limit while reporting the full total', () => {
    const { entities, total } = groupViolationsByEntity(
      [v('a', 'c1'), v('b', 'c1'), v('c', 'c2')],
      { checkIds: new Set(['c1']), limit: 1 }
    );
    expect(total).toBe(2);
    expect(entities).toHaveLength(1);
  });

  it('falls back to the entity id when the name is missing', () => {
    expect(
      groupViolationsByEntity([v('x', 'c1', 'warning', null)], { limit: 1 }).entities[0]!.entityName
    ).toBe('x');
  });
});
