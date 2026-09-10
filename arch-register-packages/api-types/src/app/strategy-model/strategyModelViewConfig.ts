import { z } from 'zod';

/**
 * Admin-configurable presentation model for the Strategy & Capability Modelling app (#3203).
 *
 * Attribute *definition* is handled by the generic entity-schema editor; this config only decides
 * *which* `business_capability` fields each strategy-app surface shows and how it aggregates and
 * colours them. It is persisted in `workspace_capability_configuration.view_config` for the
 * `strategy-model` capability and resolved client-side by `resolveStrategyModelViewConfig`.
 *
 * The config is a single ordered list of per-field entries — a field can opt into the Capabilities
 * table, the subtree roll-up, the detail drawer, and a capability-map overlay independently, and
 * the list order is the shared display order for all of them. When a workspace has no stored
 * config, `DEFAULT_STRATEGY_VIEW_CONFIG` reproduces the behaviour the screens previously hard-coded
 * (referencing the #3202 seed field ids). The Overview screen is configured separately
 * (`overviewWidgets`).
 */

export const rollupAggregationSchema = z.enum(['avg', 'sum']);
export type RollupAggregation = z.infer<typeof rollupAggregationSchema>;

export const numberFormatSchema = z.enum(['number', 'decimal1', 'currency', 'percent']);
export type NumberFormat = z.infer<typeof numberFormatSchema>;

export const bandToneSchema = z.enum(['good', 'warn', 'bad']);
export type BandTone = z.infer<typeof bandToneSchema>;

export const overlayDirectionSchema = z.enum(['higherBetter', 'lowerBetter']);
export type OverlayDirection = z.infer<typeof overlayDirectionSchema>;

/**
 * How a value is drawn in a Capabilities-table cell:
 * - `plain` — the formatted number (or the field's own formatted value when it has no roll-up).
 * - `bar` — a red/amber/green filled track over the field's 0..max range, with the value beside it.
 * - `delta` — a signed `+X.X` coloured by size; `≤ 0` reads as a dash. For gap-style fields.
 */
export const tableDisplaySchema = z.enum(['plain', 'bar', 'delta']);
export type TableDisplay = z.infer<typeof tableDisplaySchema>;

/** A colour band for a capability-map overlay. `max: null` = open top band. Evaluated low-to-high. */
export const colourBandSchema = z.object({
  max: z.number().nullable(),
  tone: bandToneSchema
});
export type ColourBand = z.infer<typeof colourBandSchema>;

/** Present when the field is shown as a Capabilities-table column. */
export const tableCellSchema = z.object({
  header: z.string().min(1).optional(),
  display: tableDisplaySchema.default('plain')
});

/** Present when the field is aggregated over each capability's containment subtree. */
export const rollupCellSchema = z.object({
  aggregation: rollupAggregationSchema,
  format: numberFormatSchema.default('decimal1')
});

/** Present when the field is offered as a capability-map overlay. */
export const overlayCellSchema = z.object({
  direction: overlayDirectionSchema.default('higherBetter'),
  format: numberFormatSchema.default('decimal1'),
  bands: z.array(colourBandSchema).default([])
});

export const fieldViewSchema = z.object({
  fieldId: z.string().min(1),
  table: tableCellSchema.nullable().default(null),
  rollup: rollupCellSchema.nullable().default(null),
  drawer: z.boolean().default(false),
  overlay: overlayCellSchema.nullable().default(null)
});
export type FieldView = z.infer<typeof fieldViewSchema>;

/** The Capabilities table's fixed leading columns — not configurable, always shown, in this order. */
export const STRUCTURAL_COLUMN_IDS = ['_name', '_level', '_owner', '_apps'] as const;
export type StructuralColumnId = (typeof STRUCTURAL_COLUMN_IDS)[number];

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

export const strategyModelViewConfigSchema = z.object({
  fields: z.array(fieldViewSchema).default([]),
  overviewWidgets: z.array(overviewWidgetSchema).default([])
});
export type StrategyModelViewConfig = z.infer<typeof strategyModelViewConfigSchema>;

/**
 * The behaviour the strategy-app screens hard-coded before #3203. Field ids are the #3202 seed ids
 * on the `business_capability` template schema.
 */
export const DEFAULT_STRATEGY_VIEW_CONFIG: StrategyModelViewConfig = {
  fields: [
    {
      fieldId: 'maturity',
      table: { header: 'Maturity', display: 'bar' },
      rollup: { aggregation: 'avg', format: 'decimal1' },
      drawer: false,
      overlay: {
        direction: 'higherBetter',
        format: 'decimal1',
        bands: [
          { max: 2.5, tone: 'bad' },
          { max: 3.5, tone: 'warn' },
          { max: null, tone: 'good' }
        ]
      }
    },
    {
      fieldId: 'maturity_target',
      table: { header: 'Target', display: 'plain' },
      rollup: { aggregation: 'avg', format: 'decimal1' },
      drawer: false,
      overlay: null
    },
    {
      fieldId: 'gap',
      table: { header: 'Gap', display: 'delta' },
      rollup: { aggregation: 'avg', format: 'decimal1' },
      drawer: false,
      overlay: {
        direction: 'lowerBetter',
        format: 'decimal1',
        bands: [
          { max: 0, tone: 'good' },
          { max: 1.5, tone: 'warn' },
          { max: null, tone: 'bad' }
        ]
      }
    },
    {
      fieldId: 'annual_investment',
      table: { header: 'Investment', display: 'plain' },
      rollup: { aggregation: 'sum', format: 'currency' },
      drawer: false,
      overlay: {
        direction: 'lowerBetter',
        format: 'currency',
        bands: [
          { max: 200_000, tone: 'good' },
          { max: 600_000, tone: 'warn' },
          { max: null, tone: 'bad' }
        ]
      }
    },
    {
      fieldId: 'risk',
      table: { header: 'Risk', display: 'plain' },
      rollup: { aggregation: 'avg', format: 'decimal1' },
      drawer: false,
      overlay: {
        direction: 'lowerBetter',
        format: 'decimal1',
        bands: [
          { max: 2.5, tone: 'good' },
          { max: 3.5, tone: 'warn' },
          { max: null, tone: 'bad' }
        ]
      }
    },
    { fieldId: 'capability_type', table: null, rollup: null, drawer: true, overlay: null },
    { fieldId: 'value_stream', table: null, rollup: null, drawer: true, overlay: null },
    { fieldId: 'strategic_importance', table: null, rollup: null, drawer: true, overlay: null },
    { fieldId: 'investment_priority', table: null, rollup: null, drawer: true, overlay: null }
  ],
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
  surface: 'fields' | 'overviewWidgets';
  fieldId: string;
  message: string;
};

const isUsableField = (
  fields: readonly ViewConfigSchemaField[],
  fieldId: string
): boolean => {
  const field = fields.find(candidate => candidate.id === fieldId);
  return field != null && field.archived !== true;
};

/**
 * Merge the stored config over the default and drop field entries whose `fieldId` no longer
 * resolves to a live (non-archived) `business_capability` field. Typed entity values are never
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

  const usableFields = base.fields.filter(field => {
    const ok = isUsableField(fields, field.fieldId);
    if (!ok)
      diagnostics.push({
        surface: 'fields',
        fieldId: field.fieldId,
        message: `View config references missing field "${field.fieldId}".`
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

  return { config: { fields: usableFields, overviewWidgets }, diagnostics };
};

// ── Derivations — the per-surface views the screens consume ───────────────────

export type DerivedRollup = {
  fieldId: string;
  aggregation: RollupAggregation;
  format: NumberFormat;
};

export type DerivedTableColumn =
  | { kind: 'structural'; fieldId: StructuralColumnId }
  | {
      kind: 'field';
      fieldId: string;
      header: string | undefined;
      display: TableDisplay;
      /** True when the cell shows the subtree roll-up rather than the capability's own value. */
      hasRollup: boolean;
      /** Number format for the roll-up value (unused for a `plain` own-value cell). */
      format: NumberFormat;
    };

export type DerivedOverlay = {
  fieldId: string;
  /** `rollup` when the field is also a roll-up (uses the subtree aggregate), else `field` (own value). */
  source: 'rollup' | 'field';
  direction: OverlayDirection;
  format: NumberFormat;
  bands: ColourBand[];
};

export const deriveRollups = (config: StrategyModelViewConfig): DerivedRollup[] =>
  config.fields
    .filter((field): field is FieldView & { rollup: NonNullable<FieldView['rollup']> } => field.rollup != null)
    .map(field => ({
      fieldId: field.fieldId,
      aggregation: field.rollup.aggregation,
      format: field.rollup.format
    }));

export const STRUCTURAL_TABLE_COLUMNS: DerivedTableColumn[] = STRUCTURAL_COLUMN_IDS.map(fieldId => ({
  kind: 'structural',
  fieldId
}));

export const deriveTableColumns = (config: StrategyModelViewConfig): DerivedTableColumn[] => [
  ...STRUCTURAL_TABLE_COLUMNS,
  ...config.fields
    .filter((field): field is FieldView & { table: NonNullable<FieldView['table']> } => field.table != null)
    .map(field => ({
      kind: 'field' as const,
      fieldId: field.fieldId,
      header: field.table.header,
      display: field.table.display,
      hasRollup: field.rollup != null,
      format: field.rollup?.format ?? 'decimal1'
    }))
];

export const deriveDrawerFieldIds = (config: StrategyModelViewConfig): string[] =>
  config.fields.filter(field => field.drawer).map(field => field.fieldId);

export const deriveOverlays = (config: StrategyModelViewConfig): DerivedOverlay[] =>
  config.fields
    .filter((field): field is FieldView & { overlay: NonNullable<FieldView['overlay']> } => field.overlay != null)
    .map(field => ({
      fieldId: field.fieldId,
      source: field.rollup != null ? 'rollup' : 'field',
      direction: field.overlay.direction,
      format: field.overlay.format,
      bands: field.overlay.bands
    }));
