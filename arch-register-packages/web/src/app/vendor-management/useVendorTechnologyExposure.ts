import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { entitiesQuery } from '../../queries/entities';
import { useEntitiesByIdSetQuery } from '../../hooks/useEntities';
import {
  computeTechnologyEolExposure,
  type TechnologyEolExposureResult
} from './technologyEolExposure';

/** One hop of a traversal provenance chain, as returned in an entity's `_projections.<alias>` —
 *  same shape as the generic entity-drawer query traversal reads. */
type TraversalHop = { context: 'entity' | 'relation'; id: string; schemaId: string };

type SystemToTechnologyReleaseLink = {
  /** The Component/Resource-like schema sitting between System and Technology Release. */
  schemaId: string;
  containmentFieldId: string;
  referenceFieldId: string;
};

export type VendorTechnologyExposureRow = {
  vendor: EntityRecord;
  contract: EntityRecord;
  system: EntityRecord;
  technologyRelease: EntityRecord;
  exposure: TechnologyEolExposureResult;
};

/** One (Vendor, Technology Release) pair, with every System reached that carries it — the shape
 *  the Risk section's EOL exposure table and its sidebar "Technology EOL" facet both render (one
 *  row per technology-and-vendor, not per system), grouped from `VendorTechnologyExposureRow[]`
 *  via `groupVendorTechnologyExposure`. */
export type GroupedVendorTechnologyExposure = {
  key: string;
  vendor: EntityRecord;
  technologyRelease: EntityRecord;
  systems: EntityRecord[];
  exposure: TechnologyEolExposureResult;
};

/** Groups `VendorTechnologyExposureRow[]` (one row per System) into one row per (Vendor,
 *  Technology Release) pair, collecting every distinct System that reaches it — mirrors the
 *  design reference's `VM_EOL` shape (one entry per technology-and-vendor, with an `apps` list),
 *  adapted from the real per-System traversal `useVendorTechnologyExposure` performs. */
export const groupVendorTechnologyExposure = (
  rows: readonly VendorTechnologyExposureRow[]
): GroupedVendorTechnologyExposure[] => {
  const byKey = new Map<string, GroupedVendorTechnologyExposure>();
  for (const row of rows) {
    const key = `${row.vendor._uid}:${row.technologyRelease._uid}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.systems.some(system => system._uid === row.system._uid)) {
        existing.systems.push(row.system);
      }
    } else {
      byKey.set(key, {
        key,
        vendor: row.vendor,
        technologyRelease: row.technologyRelease,
        systems: [row.system],
        exposure: row.exposure
      });
    }
  }
  return [...byKey.values()];
};

export type VendorTechnologyExposure = {
  items: VendorTechnologyExposureRow[];
  isLoading: boolean;
  /** True once vendor/system data has loaded but no schema links a System to the bound Technology
   *  Release schema — callers should show an explanatory empty state distinct from "still
   *  loading" or "no exposure found". */
  unavailable: boolean;
};

const EMPTY: VendorTechnologyExposure = { items: [], isLoading: false, unavailable: false };

const stringField = (entity: EntityRecord, fieldId: string): string | null => {
  const value = entity[fieldId];
  return typeof value === 'string' ? value : null;
};

/**
 * Finds every entity schema that can reach `technologyReleaseSchemaId` from `systemSchemaId` in
 * one hop each way: a `reference` field targeting the Technology Release schema (typically
 * Component/Resource), further narrowed to schemas that also `containment`-belong to the System
 * schema. Deterministic given an admin-bound `technologyReleaseSchemaId` (the `vendor-management`
 * capability's optional `technologyRelease` binding role) — no guessing at field names/shapes.
 */
const findSystemToTechnologyReleaseLinks = (
  schemas: readonly EntitySchema[],
  systemSchemaId: string,
  technologyReleaseSchemaId: string
): SystemToTechnologyReleaseLink[] =>
  schemas.flatMap(schema => {
    const referenceField = schema.fields.find(
      field => field.type === 'reference' && field.schemaId === technologyReleaseSchemaId
    );
    const containmentField = schema.fields.find(
      field => field.type === 'containment' && field.schemaId === systemSchemaId
    );
    return referenceField && containmentField
      ? [
          {
            schemaId: schema.id,
            containmentFieldId: containmentField.id,
            referenceFieldId: referenceField.id
          }
        ]
      : [];
  });

/**
 * Portfolio-wide technology EOL exposure: every (Vendor, Contract, System, Technology Release)
 * combination reachable from the vendor-management app's bound schemas, banded by
 * `computeTechnologyEolExposure`. Powers the Risk section's EOL exposure table.
 *
 * Two batched projection queries, mirroring the entity-drawer query's single-vendor traversal
 * generalized to every vendor at once (an `op: 'in'` root predicate over every vendor id, instead
 * of `equals` over one) — `EntityQuery.projections` is orthogonal to `root` (per
 * `specs/QUERY_LANGUAGE.md` §4.6), so this returns one `_projections.systems` per matched vendor:
 *
 *  1. Vendor -> (backward Contract's `vendor` field) -> Contract -> (typedRelation `system`) ->
 *     System, across every vendor with contracts.
 *  2. System -> (backward + forward, once per link `findSystemToTechnologyReleaseLinks` finds) ->
 *     Technology Release, across every distinct System reached by (1).
 *
 * Terminal ids from both hops (Contract, System, Technology Release; Vendor rows already carry
 * full fields from query 1) are resolved via `useEntitiesByIdSetQuery`.
 */
export const useVendorTechnologyExposure = (
  workspaceId: string,
  vendorSchemaId: string | null,
  vendorIds: readonly string[],
  contractSchemaId: string | null,
  systemContractRelationSchemaId: string | null,
  technologyReleaseSchemaId: string | null,
  schemas: readonly EntitySchema[]
): VendorTechnologyExposure => {
  const boxVendorIds = useMemo(() => [...vendorIds], [vendorIds]);
  const vendorsEnabled =
    !!workspaceId &&
    !!vendorSchemaId &&
    !!contractSchemaId &&
    !!systemContractRelationSchemaId &&
    boxVendorIds.length > 0;

  const vendorSystems = useQuery(
    entitiesQuery(
      workspaceId,
      {
        schemaId: vendorSchemaId ?? undefined,
        view: 'summary',
        limit: boxVendorIds.length || undefined,
        entityQuery: vendorsEnabled
          ? {
              root: {
                kind: 'predicate',
                path: [],
                fieldId: '_id',
                op: 'in',
                value: boxVendorIds
              },
              projections: [
                {
                  kind: 'path',
                  alias: 'systems',
                  path: [
                    { kind: 'backward', fieldId: 'vendor', ownerSchemaId: contractSchemaId! },
                    {
                      kind: 'typedRelation',
                      fieldId: 'system',
                      relationSchemaId: systemContractRelationSchemaId!,
                      direction: 'out',
                      ownerSchemaIds: [contractSchemaId!]
                    }
                  ]
                }
              ]
            }
          : null
      },
      vendorsEnabled
    )
  );

  // One entry per vendor, each carrying its own (contract, system) hop pairs.
  const vendorChains = useMemo(() => {
    const rows = vendorSystems.data?.items ?? [];
    return rows.map(vendor => {
      const projections = vendor._projections as { systems?: TraversalHop[][] } | undefined;
      const chains = (projections?.systems ?? [])
        .map(chain => ({ contract: chain.at(-2), system: chain.at(-1) }))
        .filter(
          (chain): chain is { contract: TraversalHop; system: TraversalHop } =>
            chain.contract != null && chain.system != null
        );
      return { vendor, chains };
    });
  }, [vendorSystems.data]);

  const systemSchemaId = useMemo(() => {
    for (const { chains } of vendorChains) {
      for (const { system } of chains) return system.schemaId;
    }
    return null;
  }, [vendorChains]);

  const distinctSystemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const { chains } of vendorChains) for (const { system } of chains) ids.add(system.id);
    return [...ids];
  }, [vendorChains]);

  const links = useMemo(
    () =>
      systemSchemaId && technologyReleaseSchemaId
        ? findSystemToTechnologyReleaseLinks(schemas, systemSchemaId, technologyReleaseSchemaId)
        : [],
    [schemas, systemSchemaId, technologyReleaseSchemaId]
  );

  const systemsEnabled =
    !!workspaceId && !!systemSchemaId && distinctSystemIds.length > 0 && links.length > 0;

  const systemTechnology = useQuery(
    entitiesQuery(
      workspaceId,
      {
        schemaId: systemSchemaId ?? undefined,
        view: 'summary',
        limit: distinctSystemIds.length || undefined,
        entityQuery: systemsEnabled
          ? {
              root: {
                kind: 'predicate',
                path: [],
                fieldId: '_id',
                op: 'in',
                value: distinctSystemIds
              },
              projections: links.map((link, index) => ({
                kind: 'path' as const,
                alias: `tech${index}`,
                path: [
                  {
                    kind: 'backward' as const,
                    fieldId: link.containmentFieldId,
                    ownerSchemaId: link.schemaId
                  },
                  { kind: 'forward' as const, fieldId: link.referenceFieldId }
                ]
              }))
            }
          : null
      },
      systemsEnabled
    )
  );

  // System _uid -> distinct Technology Release ids reached from it (across every link schema).
  const technologyReleaseIdsBySystemId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of systemTechnology.data?.items ?? []) {
      const projections = row._projections as Record<string, TraversalHop[][]> | undefined;
      const ids = new Set<string>();
      for (const chains of Object.values(projections ?? {})) {
        for (const chain of chains) {
          const terminal = chain.at(-1);
          if (terminal) ids.add(terminal.id);
        }
      }
      map.set(row._uid, [...ids]);
    }
    return map;
  }, [systemTechnology.data]);

  const lookupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const { chains } of vendorChains) {
      for (const { contract, system } of chains) {
        ids.add(contract.id);
        ids.add(system.id);
      }
    }
    for (const releaseIds of technologyReleaseIdsBySystemId.values()) {
      for (const id of releaseIds) ids.add(id);
    }
    return [...ids];
  }, [vendorChains, technologyReleaseIdsBySystemId]);

  const entities = useEntitiesByIdSetQuery(workspaceId, lookupIds, {
    enabled: vendorSystems.isSuccess && (!systemsEnabled || systemTechnology.isSuccess)
  });

  const items = useMemo<VendorTechnologyExposureRow[]>(() => {
    if (!entities.data) return [];
    const rows: VendorTechnologyExposureRow[] = [];
    for (const { vendor, chains } of vendorChains) {
      for (const { contract: contractHop, system: systemHop } of chains) {
        const contract = entities.data.get(contractHop.id);
        const system = entities.data.get(systemHop.id);
        if (!contract || !system) continue;
        const releaseIds = technologyReleaseIdsBySystemId.get(systemHop.id) ?? [];
        for (const releaseId of releaseIds) {
          const technologyRelease = entities.data.get(releaseId);
          if (!technologyRelease) continue;
          rows.push({
            vendor,
            contract,
            system,
            technologyRelease,
            exposure: computeTechnologyEolExposure({
              eolDate: stringField(technologyRelease, 'eol_date'),
              securitySupportUntil: stringField(technologyRelease, 'security_support_until')
            })
          });
        }
      }
    }
    return rows;
  }, [vendorChains, technologyReleaseIdsBySystemId, entities.data]);

  if (!vendorsEnabled) return EMPTY;

  const isLoading = vendorSystems.isLoading || systemTechnology.isLoading || entities.isLoading;
  const unavailable =
    !vendorSystems.isLoading &&
    !!technologyReleaseSchemaId &&
    !!systemSchemaId &&
    distinctSystemIds.length > 0 &&
    links.length === 0;

  return { items, isLoading, unavailable };
};
