import { useCallback, useState } from 'react';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  buildDraftEntityRecord,
  draftIdFromKey,
  draftKey,
  isDraftKey,
  type DraftEntity
} from './planChangeDraft';

const omit = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _removed, ...rest } = record;
  return rest;
};

// The members of a change case being edited (keyed as described in planChangeDraft.ts) together
// with each member's proposed state and the labels of its changed fields.
export const useChangeCaseDraftState = ({
  schemas,
  projectId
}: {
  schemas: EntitySchema[];
  projectId: string;
}) => {
  const [memberKeys, setMemberKeys] = useState<string[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [proposedStates, setProposedStates] = useState<Record<string, Record<string, unknown>>>({});
  const [changedLabels, setChangedLabels] = useState<Record<string, string[]>>({});
  const [draftEntities, setDraftEntities] = useState<Record<string, DraftEntity>>({});

  /** Replaces all members and clears every proposed state and draft entity. */
  const reset = useCallback((keys: string[]) => {
    setMemberKeys(keys);
    setActiveKey(keys[0] ?? null);
    setDraftEntities({});
    setProposedStates({});
    setChangedLabels({});
  }, []);

  const addMember = (key: string) => {
    setMemberKeys(prev => [...prev, key]);
    setActiveKey(key);
  };

  const addDraftEntity = (state: Record<string, unknown>) => {
    const id = globalThis.crypto.randomUUID();
    const entity = buildDraftEntityRecord(id, state, schemas, projectId);
    setDraftEntities(prev => ({ ...prev, [id]: { draftId: id, state, entity } }));
    addMember(draftKey(id));
  };

  const removeMember = (key: string) => {
    const next = memberKeys.filter(k => k !== key);
    setMemberKeys(next);
    if (activeKey === key) setActiveKey(next[0] ?? null);
    setProposedStates(prev => omit(prev, key));
    setChangedLabels(prev => omit(prev, key));
    if (isDraftKey(key)) setDraftEntities(prev => omit(prev, draftIdFromKey(key)));
  };

  const setProposedState = (key: string, proposedState: Record<string, unknown>) =>
    setProposedStates(prev => ({ ...prev, [key]: proposedState }));

  const setMemberChangedLabels = (key: string, labels: string[]) =>
    setChangedLabels(prev => ({ ...prev, [key]: labels }));

  return {
    memberKeys,
    activeKey,
    setActiveKey,
    proposedStates,
    changedLabels,
    draftEntities,
    reset,
    addMember,
    addDraftEntity,
    removeMember,
    setProposedState,
    setChangedLabels: setMemberChangedLabels
  };
};
