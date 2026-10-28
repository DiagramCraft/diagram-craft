import { mapViewConfigSchema } from '@arch-register/api-types/viewContract';
import { normalizeViewConfig } from './entityViewConfig';
import type { MapLevelConfig } from './mapViewState';
import type { MapColorScheme } from './mapColorScales';

export type MapConfig = {
  levelConfigs: MapLevelConfig[];
  hideMissingMetricData?: boolean;
  colorScheme?: MapColorScheme;
  reverseColors?: boolean;
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
  hideMissingMetricData: undefined,
  colorScheme: undefined,
  reverseColors: undefined
};

export const normalizeMapConfig = (raw: unknown): MapConfig => {
  const parsed = normalizeViewConfig(mapViewConfigSchema, raw, {
    ...DEFAULT_MAP_CONFIG,
    levelConfigs: undefined as MapLevelConfig[] | undefined
  });
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
      hideMissingMetricData: parsed.hideMissingMetricData,
      colorScheme: parsed.colorScheme,
      reverseColors: parsed.reverseColors
    };
  }
  return {
    levelConfigs: DEFAULT_MAP_CONFIG.levelConfigs,
    fieldIds: parsed.fieldIds,
    metricConfig: parsed.metricConfig,
    hideMissingMetricData: parsed.hideMissingMetricData,
    colorScheme: parsed.colorScheme,
    reverseColors: parsed.reverseColors
  };
};
