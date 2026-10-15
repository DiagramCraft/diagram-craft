import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';

/**
 * Provider/consumer pairs around a shared "hub" entity, and their coverage by a third relation
 * type. Two relation sets point at hub entities (e.g. `Provides API` / `Consumes API`, hub = API);
 * the coverage relations (e.g. `Data Flow`) join the two non-hub endpoints directly. This module
 * computes every provider × consumer pair for each hub, and whether a coverage relation exists
 * between that pair's two endpoints (either direction), independent of whether one does.
 *
 * The coverage relation type may only connect some endpoint types (Data Flow is System ↔ System,
 * while an API's provider may be a Component). There is no schema-kind hint shipped to the client,
 * so eligibility is inferred from the endpoint `schemaId`s actually observed on the coverage
 * relations — a pair counts as `coverageApplicable` only when both endpoints' `schemaId` is in
 * that observed set. With no coverage relations yet there is nothing to observe, so every pair is
 * treated as applicable rather than misreported as "not applicable".
 */

export type EndpointRef = { id: string; name: string; schemaId?: string };

export type RelationPair = {
  /** Stable per-row key: `${consumer.id}:${hub.id}:${provider.id}`. */
  key: string;
  consumer: EndpointRef;
  provider: EndpointRef;
  hub: EndpointRef;
  consumerRelationId: string;
  providerRelationId: string;
  /** Whether a coverage relation exists between `consumer` and `provider`, either direction. */
  hasCoverage: boolean;
  /** False when either endpoint's type can never have a matching coverage relation. */
  coverageApplicable: boolean;
};

export type RelationPairCoverageSummary = {
  totalPairs: number;
  applicablePairs: number;
  coveredPairs: number;
  gapPairs: number;
  notApplicablePairs: number;
};

/** The hub of a provider/consumer relation is its `_out` endpoint. */
const groupByHub = (relations: RelationRecord[]): Map<string, RelationRecord[]> => {
  const map = new Map<string, RelationRecord[]>();
  for (const relation of relations) {
    const existing = map.get(relation._out.id);
    if (existing) existing.push(relation);
    else map.set(relation._out.id, [relation]);
  }
  return map;
};

const coveragePairKey = (aId: string, bId: string): string => [aId, bId].sort().join('::');

export const computeRelationPairs = (
  providers: RelationRecord[],
  consumers: RelationRecord[],
  coverageRelations: RelationRecord[]
): RelationPair[] => {
  const providersByHub = groupByHub(providers);
  const consumersByHub = groupByHub(consumers);

  const coveragePairs = new Set(
    coverageRelations.map(relation => coveragePairKey(relation._in.id, relation._out.id))
  );
  const systemSchemaIds = new Set(
    coverageRelations.flatMap(relation =>
      [relation._in.schemaId, relation._out.schemaId].filter(
        (schemaId): schemaId is string => schemaId != null
      )
    )
  );
  const isEligibleEndpoint = (endpoint: EndpointRef): boolean =>
    systemSchemaIds.size === 0 ||
    (endpoint.schemaId != null && systemSchemaIds.has(endpoint.schemaId));

  const hubIds = new Set([...providersByHub.keys(), ...consumersByHub.keys()]);
  const pairs: RelationPair[] = [];
  for (const hubId of hubIds) {
    const providerRelations = providersByHub.get(hubId) ?? [];
    const consumerRelations = consumersByHub.get(hubId) ?? [];
    for (const providerRelation of providerRelations) {
      for (const consumerRelation of consumerRelations) {
        const provider = providerRelation._in;
        const consumer = consumerRelation._in;
        if (consumer.id === provider.id) continue; // an entity providing and consuming its own API isn't a flow

        const hasCoverage = coveragePairs.has(coveragePairKey(consumer.id, provider.id));
        const coverageApplicable = isEligibleEndpoint(consumer) && isEligibleEndpoint(provider);

        pairs.push({
          key: `${consumer.id}:${hubId}:${provider.id}`,
          consumer,
          provider,
          hub: providerRelation._out,
          consumerRelationId: consumerRelation._uid,
          providerRelationId: providerRelation._uid,
          hasCoverage,
          coverageApplicable
        });
      }
    }
  }
  return pairs;
};

export const computeRelationPairCoverage = (pairs: RelationPair[]): RelationPairCoverageSummary => {
  const applicable = pairs.filter(pair => pair.coverageApplicable);
  const covered = applicable.filter(pair => pair.hasCoverage);
  return {
    totalPairs: pairs.length,
    applicablePairs: applicable.length,
    coveredPairs: covered.length,
    gapPairs: applicable.length - covered.length,
    notApplicablePairs: pairs.length - applicable.length
  };
};

/**
 * Resolves the relation schema id behind a `typedRelation` field of the hub schema, matching the
 * field by id or display name (names keep seeded configs workspace-independent). `null` when the
 * field is missing or isn't a typed relation.
 */
export const resolveTypedRelationSchemaId = (
  hubSchema: EntitySchema | undefined,
  fieldIdOrName: string
): string | null => {
  const field = hubSchema?.fields.find(
    candidate => candidate.id === fieldIdOrName || candidate.name === fieldIdOrName
  );
  return field?.type === 'typedRelation' ? field.relationSchemaId : null;
};
