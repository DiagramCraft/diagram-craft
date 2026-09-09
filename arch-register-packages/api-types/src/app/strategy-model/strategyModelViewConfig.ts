import { z } from 'zod';

/**
 * Admin-configurable presentation model for the Strategy & Capability Modelling app (#3203).
 *
 * Attribute *definition* is handled by the generic entity-schema editor; this config only decides
 * *which* `business_capability` fields each strategy-app surface shows and how it aggregates,
 * buckets and colours them. It is persisted in `workspace_capability_configuration.view_config`
 * for the `strategy-model` capability and resolved client-side by `resolveStrategyModelViewConfig`.
 *
 * When a workspace has no stored config, `DEFAULT_STRATEGY_VIEW_CONFIG` reproduces the behaviour
 * the screens previously hard-coded (referencing the #3202 seed field ids).
 */

export const rollupAggregationSchema = z.enum(['avg', 'sum']);
export type RollupAggregation = z.infer<typeof rollupAggregationSchema>;

export const numberFormatSchema = z.enum(['number', 'decimal1', 'currency', 'percent']);
export type NumberFormat = z.infer<typeof numberFormatSchema>;

export const bandToneSchema = z.enum(['good', 'warn', 'bad']);
export type BandTone = z.infer<typeof bandToneSchema>;

/**
 * How a roll-up value is drawn in a table cell:
 * - `plain` — the formatted number.
 * - `bar` — a red/amber/green filled track over the field's 0..max range, with the value beside it.
 * - `delta` — a signed `+X.X` coloured by size; `≤ 0` (on or ahead of target) reads as a dash.
 */
export const rollupDisplaySchema = z.enum(['plain', 'bar', 'delta']);
export type RollupDisplay = z.infer<typeof rollupDisplaySchema>;

/** One roll-up metric: a numeric `business_capability` field aggregated over the containment subtree. */
export const rollupFieldSchema = z.object({
  fieldId: z.string().min(1),
  aggregation: rollupAggregationSchema,
  label: z.string().min(1).optional(),
  format: numberFormatSchema.default('decimal1'),
  display: rollupDisplaySchema.default('plain')
});
export type RollupField = z.infer<typeof rollupFieldSchema>;

/** A colour band for a capability-map overlay, ordered best-to-worst. `max: null` = open top band. */
export const colourBandSchema = z.object({
  max: z.number().nullable(),
  tone: bandToneSchema
});
export type ColourBand = z.infer<typeof colourBandSchema>;

export const overlaySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** `field` reads the capability's own value; `rollup` reads the subtree aggregate of the same id. */
  source: z.enum(['field', 'rollup']),
  fieldId: z.string().min(1),
  direction: z.enum(['higherBetter', 'lowerBetter']),
  bands: z.array(colourBandSchema).default([]),
  format: numberFormatSchema.default('decimal1')
});
export type Overlay = z.infer<typeof overlaySchema>;

/**
 * A Capabilities-table column. `fieldId` is either a `business_capability` field id or one of the
 * structural pseudo ids below.
 */
export const TABLE_PSEUDO_FIELD_IDS = ['_name', '_level', '_owner', '_apps'] as const;
export type TablePseudoFieldId = (typeof TABLE_PSEUDO_FIELD_IDS)[number];

export const tableColumnSchema = z.object({
  fieldId: z.string().min(1),
  label: z.string().min(1).optional(),
  visible: z.boolean().default(true)
});
export type TableColumn = z.infer<typeof tableColumnSchema>;

export const overviewWidgetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('countByLevel'), title: z.string().min(1) }),
  z.object({ kind: z.literal('countBySelect'), fieldId: z.string().min(1), title: z.string().min(1) }),
  z.object({ kind: z.literal('coveragePercent'), title: z.string().min(1) }),
  z.object({ kind: z.literal('orphanCount'), title: z.string().min(1) }),
  z.object({
    kind: z.literal('topGap'),
    fieldId: z.string().min(1),
    limit: z.number().int().min(1).max(20).default(5),
    title: z.string().min(1)
  })
]);
export type OverviewWidget = z.infer<typeof overviewWidgetSchema>;

export const strategyModelViewConfigSchema = z
  .object({
    tableColumns: z.array(tableColumnSchema).default([]),
    rollups: z.array(rollupFieldSchema).default([]),
    overlays: z.array(overlaySchema).default([]),
    drawerFieldIds: z.array(z.string().min(1)).default([]),
    overviewWidgets: z.array(overviewWidgetSchema).default([])
  });
export type StrategyModelViewConfig = z.infer<typeof strategyModelViewConfigSchema>;

/**
 * The behaviour the strategy-app screens hard-coded before #3203. Field ids are the #3202 seed ids
 * on the `business_capability` template schema.
 */
export const DEFAULT_STRATEGY_VIEW_CONFIG: StrategyModelViewConfig = {
  tableColumns: [
    { fieldId: '_name', visible: true },
    { fieldId: '_level', label: 'Level', visible: true },
    { fieldId: '_owner', label: 'Owner', visible: true },
    { fieldId: 'maturity', label: 'Maturity', visible: true },
    { fieldId: 'maturity_target', label: 'Target', visible: true },
    { fieldId: 'gap', label: 'Gap', visible: true },
    { fieldId: 'annual_investment', label: 'Investment', visible: true },
    { fieldId: 'risk', label: 'Risk', visible: true },
    { fieldId: '_apps', label: 'Apps', visible: true }
  ],
  rollups: [
    { fieldId: 'maturity', aggregation: 'avg', label: 'Maturity', format: 'decimal1', display: 'bar' },
    {
      fieldId: 'maturity_target',
      aggregation: 'avg',
      label: 'Target',
      format: 'decimal1',
      display: 'plain'
    },
    { fieldId: 'gap', aggregation: 'avg', label: 'Gap', format: 'decimal1', display: 'delta' },
    { fieldId: 'risk', aggregation: 'avg', label: 'Risk', format: 'decimal1', display: 'plain' },
    {
      fieldId: 'annual_investment',
      aggregation: 'sum',
      label: 'Investment',
      format: 'currency',
      display: 'plain'
    }
  ],
  overlays: [
    {
      id: 'maturity',
      label: 'Maturity',
      source: 'rollup',
      fieldId: 'maturity',
      direction: 'higherBetter',
      format: 'decimal1',
      bands: [
        { max: 2.5, tone: 'bad' },
        { max: 3.5, tone: 'warn' },
        { max: null, tone: 'good' }
      ]
    },
    {
      id: 'gap',
      label: 'Maturity gap',
      source: 'rollup',
      fieldId: 'gap',
      direction: 'lowerBetter',
      format: 'decimal1',
      bands: [
        { max: 0, tone: 'good' },
        { max: 1.5, tone: 'warn' },
        { max: null, tone: 'bad' }
      ]
    },
    {
      id: 'risk',
      label: 'Risk',
      source: 'rollup',
      fieldId: 'risk',
      direction: 'lowerBetter',
      format: 'decimal1',
      bands: [
        { max: 2.5, tone: 'good' },
        { max: 3.5, tone: 'warn' },
        { max: null, tone: 'bad' }
      ]
    },
    {
      id: 'investment',
      label: 'Investment',
      source: 'rollup',
      fieldId: 'annual_investment',
      direction: 'lowerBetter',
      format: 'currency',
      bands: [
        { max: 200_000, tone: 'good' },
        { max: 600_000, tone: 'warn' },
        { max: null, tone: 'bad' }
      ]
    }
  ],
  drawerFieldIds: ['capability_type', 'value_stream', 'strategic_importance', 'investment_priority'],
  overviewWidgets: [
    { kind: 'countByLevel', title: 'Capabilities by level' },
    { kind: 'countBySelect', fieldId: 'status', title: 'Objectives by status' },
    { kind: 'coveragePercent', title: 'Application coverage' },
    { kind: 'orphanCount', title: 'Orphan capabilities' },
    { kind: 'topGap', fieldId: 'gap', limit: 5, title: 'Largest maturity gaps' }
  ]
};

/** Minimal shape of an entity-schema field needed to validate a view config against live schema. */
export type ViewConfigSchemaField = { id: string; type: string; archived?: boolean };

export type ViewConfigDiagnostic = {
  surface: 'tableColumns' | 'rollups' | 'overlays' | 'drawerFieldIds' | 'overviewWidgets';
  fieldId: string;
  message: string;
};

const isUsableField = (
  fields: readonly ViewConfigSchemaField[],
  fieldId: string,
  pseudo: readonly string[] = []
): boolean => {
  if (pseudo.includes(fieldId)) return true;
  const field = fields.find(candidate => candidate.id === fieldId);
  return field != null && field.archived !== true;
};

/**
 * Merge stored config over the default and drop entries whose `fieldId` no longer resolves to a
 * live (non-archived) field on the `business_capability` schema. Typed entity values are never
 * touched — a retired field simply stops appearing. Returns the usable config plus diagnostics
 * describing what was dropped (surfaced in the admin editor).
 */
export const resolveStrategyModelViewConfig = (
  raw: unknown,
  fields: readonly ViewConfigSchemaField[]
): { config: StrategyModelViewConfig; diagnostics: ViewConfigDiagnostic[] } => {
  const parsed = strategyModelViewConfigSchema.safeParse(
    raw == null || (typeof raw === 'object' && Object.keys(raw as object).length === 0)
      ? DEFAULT_STRATEGY_VIEW_CONFIG
      : raw
  );
  const base = parsed.success ? parsed.data : DEFAULT_STRATEGY_VIEW_CONFIG;
  const diagnostics: ViewConfigDiagnostic[] = [];

  const tableColumns = base.tableColumns.filter(column => {
    const ok = isUsableField(fields, column.fieldId, TABLE_PSEUDO_FIELD_IDS);
    if (!ok)
      diagnostics.push({
        surface: 'tableColumns',
        fieldId: column.fieldId,
        message: `Table column references missing field "${column.fieldId}".`
      });
    return ok;
  });

  const rollups = base.rollups.filter(rollup => {
    const ok = isUsableField(fields, rollup.fieldId);
    if (!ok)
      diagnostics.push({
        surface: 'rollups',
        fieldId: rollup.fieldId,
        message: `Roll-up references missing field "${rollup.fieldId}".`
      });
    return ok;
  });

  const overlays = base.overlays.filter(overlay => {
    const ok = isUsableField(fields, overlay.fieldId);
    if (!ok)
      diagnostics.push({
        surface: 'overlays',
        fieldId: overlay.fieldId,
        message: `Overlay "${overlay.label}" references missing field "${overlay.fieldId}".`
      });
    return ok;
  });

  const drawerFieldIds = base.drawerFieldIds.filter(fieldId => {
    const ok = isUsableField(fields, fieldId);
    if (!ok)
      diagnostics.push({
        surface: 'drawerFieldIds',
        fieldId,
        message: `Detail drawer references missing field "${fieldId}".`
      });
    return ok;
  });

  // Only `topGap` is validated against the capability schema — `countBySelect` typically targets a
  // field on the objective schema, which is out of scope for this check.
  const overviewWidgets = base.overviewWidgets.filter(widget => {
    if (widget.kind !== 'topGap') return true;
    const ok = isUsableField(fields, widget.fieldId);
    if (!ok)
      diagnostics.push({
        surface: 'overviewWidgets',
        fieldId: widget.fieldId,
        message: `Overview widget "${widget.title}" references missing field "${widget.fieldId}".`
      });
    return ok;
  });

  return {
    config: { tableColumns, rollups, overlays, drawerFieldIds, overviewWidgets },
    diagnostics
  };
};
