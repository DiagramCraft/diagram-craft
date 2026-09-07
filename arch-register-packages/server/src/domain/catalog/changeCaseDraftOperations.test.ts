import { describe, expect, it } from 'vitest';
import type { CreateChangeCaseRequest } from '@arch-register/api-types/changeCaseContract';
import { assertDraftReferences } from './changeCaseDraftOperations';

const member = (draftId: string): CreateChangeCaseRequest['members'][number] => ({
  draftId,
  proposedState: {}
});

const draft = (draftId: string): CreateChangeCaseRequest['newEntities'][number] => ({
  draftId,
  state: {}
});

describe('assertDraftReferences', () => {
  it('accepts drafts that are referenced by exactly one case member', () => {
    expect(() => assertDraftReferences([member('draft-a')], [draft('draft-a')])).not.toThrow();
  });

  it('rejects a case member that references an undefined draft', () => {
    expect(() => assertDraftReferences([member('missing')], [])).toThrow(
      "Draft entity 'missing' is not defined"
    );
  });

  it('rejects a draft that is not included as a case member', () => {
    expect(() => assertDraftReferences([], [draft('unused')])).toThrow(
      "Draft entity 'unused' is not part of the change case"
    );
  });
});
