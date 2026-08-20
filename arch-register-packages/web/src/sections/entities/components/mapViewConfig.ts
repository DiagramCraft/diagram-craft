import { mapViewConfigSchema } from '@arch-register/api-types/viewContract';
import { normalizeViewConfig } from './entityViewConfig';
import type { MapLevelConfig } from './mapViewState';

export type MapConfig = {
  levelConfigs: MapLevelConfig[];
  hideMissingMetricData?: boolean;
  fieldIds?: string[];
  metricConfig?: unknown;
};

// `fieldIds`/`metricConfig` are explicitly included (as undefined) so normalizeViewConfig's
// field-merge loop picks them up from a parsed config when present.
export const DEFAULT_MAP_CONFIG: MapConfig = {
  levelConfigs: [
    { schemaId: null, columns: 3 },
    { schemaId: null, columns: 3 }
  ],
  fieldIds: undefined,
  metricConfig: undefined,
  hideMissingMetricData: undefined
};

const legacyMapConfigDefaults = {
  ...DEFAULT_MAP_CONFIG,
  levels: 2,
  level1SchemaId: null as string | null,
  level1Columns: 3,
  level2SchemaId: null as string | null,
  level2Columns: 3,
  level3SchemaId: null as string | null,
  level3Columns: 3,
  levelConfigs: undefined as MapLevelConfig[] | undefined
};

export const normalizeMapConfig = (raw: unknown): MapConfig => {
  const parsed = normalizeViewConfig(mapViewConfigSchema, raw, legacyMapConfigDefaults);
  if (parsed.levelConfigs?.length) {
    return {
      levelConfigs: parsed.levelConfigs.map(level => ({
        schemaId: level.schemaId,
        columns: level.columns ?? 3,
        ...(level.hidden ? { hidden: true } : {}),
        ...(level.step ? { step: level.step } : {}),
        ...(level.targetSchemaId ? { targetSchemaId: level.targetSchemaId } : {})
      })),
      fieldIds: parsed.fieldIds,
      metricConfig: parsed.metricConfig,
      hideMissingMetricData: parsed.hideMissingMetricData
    };
  }
  const legacyIds = [parsed.level1SchemaId, parsed.level2SchemaId, parsed.level3SchemaId];
  const legacyColumns = [parsed.level1Columns, parsed.level2Columns, parsed.level3Columns];
  return {
    levelConfigs: legacyIds.slice(0, parsed.levels).map((schemaId, index) => ({
      schemaId,
      columns: legacyColumns[index] ?? 3
    })),
    fieldIds: parsed.fieldIds,
    metricConfig: parsed.metricConfig,
    hideMissingMetricData: parsed.hideMissingMetricData
  };
};
