import type { RelationRecord } from '@arch-register/api-types/relationContract';

/**
 * Provider/consumer pairs and their Data Flow coverage (#3340, follow-up to #3317). `Provides API`
 * / `Consumes API` typed relations (System/Component ↔ API) and `Data Flow` relations (System ↔
 * System) are complementary, not redundant — this module computes every provider × consumer pair
 * for each registered API, and whether a Data Flow relation exists between that pair's two
 * endpoints, independent of whether one does.
 *
 * `Data Flow` is strictly System ↔ System (a `Provides`/`Consumes API` endpoint may instead be a
 * Component, which can never have a matching Data Flow relation). There is no `symId`/entity-schema
 * name shipped to the client to identify "System" by, so eligibility is instead inferred from the
 * relation endpoints' `schemaId` actually observed on the workspace's Data Flow relations — a pair
 * counts as `dataFlowApplicable` only when both endpoints' `schemaId` is in that observed set. A
 * workspace with no Data Flow relations yet has nothing to observe, so every pair is treated as
 * applicable rather than misreported as "not applicable".
 */

export type EndpointRef = { id: string; name: string; schemaId?: string };

export type ApiPair = {
  /** Stable per-row key: `${consumer.id}:${api.id}:${provider.id}`. */
  key: string;
  consumer: EndpointRef;
  provider: EndpointRef;
  api: EndpointRef;
  consumerRelationId: string;
  providerRelationId: string;
  /** Whether a Data Flow relation exists between `consumer` and `provider`, either direction. */
  hasDataFlow: boolean;
  /** False when either endpoint is Component-typed — can never have a matching Data Flow relation. */
  dataFlowApplicable: boolean;
};

export type ApiPairCoverageSummary = {
  totalPairs: number;
  applicablePairs: number;
  coveredPairs: number;
  gapPairs: number;
  notApplicablePairs: number;
};

const groupByApiId = (relations: RelationRecord[]): Map<string, RelationRecord[]> => {
  const map = new Map<string, RelationRecord[]>();
  for (const relation of relations) {
    const apiId = relation._out.id;
    const existing = map.get(apiId);
    if (existing) existing.push(relation);
    else map.set(apiId, [relation]);
  }
  return map;
};

const dataFlowPairKey = (aId: string, bId: string): string => [aId, bId].sort().join('::');

export const computeApiPairs = (
  providers: RelationRecord[],
  consumers: RelationRecord[],
  dataFlowRelations: RelationRecord[]
): ApiPair[] => {
  const providersByApi = groupByApiId(providers);
  const consumersByApi = groupByApiId(consumers);

  const dataFlowPairs = new Set(
    dataFlowRelations.map(relation => dataFlowPairKey(relation._in.id, relation._out.id))
  );
  const systemSchemaIds = new Set(
    dataFlowRelations.flatMap(relation =>
      [relation._in.schemaId, relation._out.schemaId].filter(
        (schemaId): schemaId is string => schemaId != null
      )
    )
  );
  const isEligibleEndpoint = (endpoint: EndpointRef): boolean =>
    systemSchemaIds.size === 0 ||
    (endpoint.schemaId != null && systemSchemaIds.has(endpoint.schemaId));

  const apiIds = new Set([...providersByApi.keys(), ...consumersByApi.keys()]);
  const pairs: ApiPair[] = [];
  for (const apiId of apiIds) {
    const providerRelations = providersByApi.get(apiId) ?? [];
    const consumerRelations = consumersByApi.get(apiId) ?? [];
    for (const providerRelation of providerRelations) {
      for (const consumerRelation of consumerRelations) {
        const provider = providerRelation._in;
        const consumer = consumerRelation._in;
        if (consumer.id === provider.id) continue; // an entity providing and consuming its own API isn't a flow

        const hasDataFlow = dataFlowPairs.has(dataFlowPairKey(consumer.id, provider.id));
        const dataFlowApplicable = isEligibleEndpoint(consumer) && isEligibleEndpoint(provider);

        pairs.push({
          key: `${consumer.id}:${apiId}:${provider.id}`,
          consumer,
          provider,
          api: providerRelation._out,
          consumerRelationId: consumerRelation._uid,
          providerRelationId: providerRelation._uid,
          hasDataFlow,
          dataFlowApplicable
        });
      }
    }
  }
  return pairs;
};

export const computeApiPairCoverage = (pairs: ApiPair[]): ApiPairCoverageSummary => {
  const applicable = pairs.filter(pair => pair.dataFlowApplicable);
  const covered = applicable.filter(pair => pair.hasDataFlow);
  return {
    totalPairs: pairs.length,
    applicablePairs: applicable.length,
    coveredPairs: covered.length,
    gapPairs: applicable.length - covered.length,
    notApplicablePairs: pairs.length - applicable.length
  };
};
