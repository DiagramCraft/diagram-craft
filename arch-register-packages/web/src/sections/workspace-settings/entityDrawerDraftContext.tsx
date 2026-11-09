import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { EntityDrawerConfiguration } from '@arch-register/api-types/entityDrawerConfiguration';
import { normalizeLegacyEntityDrawerConfiguration } from '@arch-register/api-types/entityDrawerConfiguration';
import {
  useEntityDrawerConfiguration,
  useUpdateEntityDrawerConfiguration
} from '../../hooks/useWorkspaceConfig';

const EMPTY_CONFIGURATION: EntityDrawerConfiguration = { version: 1, profiles: {} };

const clone = (configuration: EntityDrawerConfiguration): EntityDrawerConfiguration =>
  JSON.parse(JSON.stringify(configuration)) as EntityDrawerConfiguration;

export const validateEntityDrawerDraft = (configuration: EntityDrawerConfiguration): string[] =>
  Object.entries(configuration.profiles).flatMap(([schemaId, profile]) =>
    profile.sections.flatMap(section =>
      section.items.flatMap(item => {
        if (item.kind !== 'query') return [];
        return (item.fields ?? []).flatMap(field =>
          field.fieldId.trim() === ''
            ? [
                `Schema '${schemaId}', section '${section.title}': query result fields require a field id.`
              ]
            : []
        );
      })
    )
  );

/**
 * Draft of the workspace-wide entity drawer configuration. It is owned by the schema editor
 * screen so that the page-level Save / Cancel buttons can save and discard it together with
 * the schema draft.
 */
export const useEntityDrawerDraft = (workspaceSlug: string, schemaId: string | undefined) => {
  const configurationQuery = useEntityDrawerConfiguration(workspaceSlug);
  const update = useUpdateEntityDrawerConfiguration(workspaceSlug);
  const [draft, setDraft] = useState<EntityDrawerConfiguration | null>(null);

  const stored = configurationQuery.data?.stored_configuration;
  const baseline = useMemo(() => {
    const normalized = normalizeLegacyEntityDrawerConfiguration(stored);
    return normalized &&
      typeof normalized === 'object' &&
      'version' in normalized &&
      normalized.version === 1
      ? clone(normalized as EntityDrawerConfiguration)
      : EMPTY_CONFIGURATION;
  }, [stored]);

  // Reload the draft when the saved configuration changes or another schema is selected
  // biome-ignore lint/correctness/useExhaustiveDependencies: schemaId is a reset trigger
  useEffect(() => {
    setDraft(clone(baseline));
  }, [baseline, schemaId]);

  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(baseline);
  const validationErrors = useMemo(() => (draft ? validateEntityDrawerDraft(draft) : []), [draft]);

  const edit = useCallback(
    (next: EntityDrawerConfiguration) => {
      update.reset();
      setDraft(next);
    },
    [update]
  );

  const revert = useCallback(() => {
    update.reset();
    setDraft(clone(baseline));
  }, [baseline, update]);

  const save = useCallback(async () => {
    if (!draft || !dirty || validationErrors.length > 0) return;
    try {
      await update.mutateAsync(draft);
    } catch {
      // surfaced through `saveError`
    }
  }, [dirty, draft, update, validationErrors.length]);

  return {
    configurationQuery,
    draft,
    edit,
    dirty,
    validationErrors,
    revert,
    save,
    isSaving: update.isPending,
    saveError: update.error instanceof Error ? update.error.message : null
  };
};

export type EntityDrawerDraft = ReturnType<typeof useEntityDrawerDraft>;

const EntityDrawerDraftContext = createContext<EntityDrawerDraft | null>(null);

export const EntityDrawerDraftProvider = ({
  draft,
  children
}: {
  draft: EntityDrawerDraft;
  children: ReactNode;
}) => (
  <EntityDrawerDraftContext.Provider value={draft}>{children}</EntityDrawerDraftContext.Provider>
);

export const useEntityDrawerDraftContext = () => {
  const draft = useContext(EntityDrawerDraftContext);
  if (!draft) {
    throw new Error('useEntityDrawerDraftContext must be used inside an EntityDrawerDraftProvider');
  }
  return draft;
};
