import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRelations } from '../../hooks/useRelations';
import { useEntitiesByIdSetQuery } from '../../hooks/useEntities';
import { entitiesQuery } from '../../queries/entities';
import { relationIds } from '../../lib/entityEditState';

export type ControlFrameworkOption = { id: string; name: string; controlCount: number };

export type ControlFrameworks = {
  /** Control `_uid` -> the names of every Framework it satisfies a requirement under, via
   *  `satisfied_requirements` (`control-requirement`) -> Compliance Requirement's `framework`
   *  containment field. */
  frameworkNamesByControlId: Map<string, Set<string>>;
  frameworkOptions: ControlFrameworkOption[];
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: ControlFrameworks = {
  frameworkNamesByControlId: new Map(),
  frameworkOptions: [],
  isLoading: false,
  error: null
};

/**
 * Derives, for the Controls sidebar's "Framework" facet and library table, which Frameworks each
 * Control satisfies at least one requirement under. No single relation carries this directly —
 * it's a two-hop join over `control-requirement` (Control <-> Compliance Requirement) and
 * Compliance Requirement's own `framework` containment field (Compliance Requirement -> Framework)
 * — so this manually joins three batched fetches rather than reaching for the structured
 * entity-traversal engine (the drawer's generic `query` item, `useEntityDrawerQueryItem.ts`'s
 * `path` projections), matching this app's existing "join relations by hand" style
 * (the shared entity drawer) since
 * there's no drawer-level provenance need here, just a name/count roll-up. Faceted at Framework
 * granularity only — clause-level (`compliance_requirement`) detail is the traceability matrix's
 * job (#3282).
 */
export const useControlFrameworks = (
  workspaceId: string,
  controlRequirementRelationSchemaId: string | null,
  complianceRequirementSchemaId: string | null
): ControlFrameworks => {
  const enabled = !!controlRequirementRelationSchemaId && !!complianceRequirementSchemaId;

  const relations = useRelations(
    workspaceId,
    { schemaId: controlRequirementRelationSchemaId ?? undefined, limit: 1000 },
    { enabled }
  );
  const requirements = useQuery(
    entitiesQuery(
      workspaceId,
      { schemaId: complianceRequirementSchemaId ?? undefined, view: 'full', limit: 1000 },
      enabled
    )
  );

  const frameworkIdByRequirementId = useMemo(() => {
    const map = new Map<string, string>();
    for (const requirement of requirements.data?.items ?? []) {
      const frameworkId = relationIds(requirement.framework)[0];
      if (frameworkId) map.set(requirement._uid, frameworkId);
    }
    return map;
  }, [requirements.data]);

  const frameworks = useEntitiesByIdSetQuery(
    workspaceId,
    [...new Set(frameworkIdByRequirementId.values())],
    { enabled: requirements.isSuccess }
  );

  const { frameworkNamesByControlId, frameworkOptions } = useMemo(() => {
    const byControl = new Map<string, Set<string>>();
    const controlCountByFrameworkId = new Map<string, Set<string>>();
    for (const relation of relations.data) {
      // Control is the `_in` side of `control-requirement` (`inSymSchemaIds: ['control']`),
      // Compliance Requirement the `_out` side — same "read the role off `_in`/`_out` directly"
      // rule as the entity drawer.
      const controlId = relation._in.id;
      const requirementId = relation._out.id;
      const frameworkId = frameworkIdByRequirementId.get(requirementId);
      const framework = frameworkId ? frameworks.data?.get(frameworkId) : undefined;
      if (!framework) continue;
      const names = byControl.get(controlId) ?? new Set<string>();
      names.add(framework._name);
      byControl.set(controlId, names);
      const controls = controlCountByFrameworkId.get(frameworkId!) ?? new Set<string>();
      controls.add(controlId);
      controlCountByFrameworkId.set(frameworkId!, controls);
    }
    const frameworkOptions: ControlFrameworkOption[] = [...controlCountByFrameworkId.entries()]
      .map(([id, controls]) => ({
        id,
        name: frameworks.data?.get(id)?._name ?? id,
        controlCount: controls.size
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { frameworkNamesByControlId: byControl, frameworkOptions };
  }, [relations.data, frameworkIdByRequirementId, frameworks.data]);

  if (!enabled) return EMPTY;

  const isLoading = relations.isLoading || requirements.isLoading || frameworks.isLoading;
  const firstError = relations.error ?? requirements.error ?? frameworks.error ?? null;
  const error =
    firstError instanceof Error ? firstError : firstError ? new Error(String(firstError)) : null;

  return { frameworkNamesByControlId, frameworkOptions, isLoading, error };
};
