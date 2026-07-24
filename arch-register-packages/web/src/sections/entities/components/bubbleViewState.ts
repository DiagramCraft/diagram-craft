import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { getCategoricalValue, getNumericValue, type FieldOption } from './entityFieldSources';
import { stableHash } from './stableHash';

export type BubbleConfig = {
  xFieldId: string;
  yFieldId: string;
  sizeFieldId: string | null;
  colorFieldId: string | null;
};

export type Bubble = {
  id: string;
  name: string;
  description: string;
  schemaName: string;
  colorValue: string | null;
  cx: number;
  cy: number;
  r: number;
  color: string;
  clusterCount: number;
  xDisplay: string;
  yDisplay: string;
  sizeDisplay: string | null;
  colorDisplay: string | null;
};

export const MARGIN_LEFT = 64;
export const MARGIN_RIGHT = 24;
export const MARGIN_TOP = 24;
export const MARGIN_BOTTOM = 48;
export const PLOT_W = 760;
export const PLOT_H = 480;
export const VB_W = MARGIN_LEFT + PLOT_W + MARGIN_RIGHT;
export const VB_H = MARGIN_TOP + PLOT_H + MARGIN_BOTTOM;
export const MIN_R = 6;
export const MAX_R = 26;
export const UNIFORM_R = 10;
export const UNIFORM_COLOR = 'var(--accent-fg)';

export const BUBBLE_COLORS = [
  'var(--tag-api)',
  'var(--tag-component)',
  'var(--tag-database)',
  'var(--tag-system)',
  'var(--tag-service)',
  'var(--accent-fg)',
  'var(--warning-fg)',
  'oklch(0.62 0.14 180)'
];

export const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

export const formatAxisValue = (
  entity: EntityRecord,
  fieldId: string,
  categories: FieldOption[] | null
): string | null => {
  if (categories) {
    const value = getCategoricalValue(entity, fieldId);
    if (value == null) return null;
    return categories.find(category => category.id === value)?.label ?? value;
  }
  const value = getNumericValue(entity, fieldId);
  return value == null ? null : formatNumber(value);
};

export const positionOnBubbleAxis = (
  entity: EntityRecord,
  fieldId: string,
  range: { min: number; max: number } | null,
  categories: FieldOption[] | null,
  pixelMin: number,
  pixelMax: number,
  invert: boolean
): number | null => {
  let normalized: number | null = null;
  if (categories) {
    const value = getCategoricalValue(entity, fieldId);
    const index = value == null ? -1 : categories.findIndex(category => category.id === value);
    if (index === -1) return null;
    normalized = (index + 0.5) / categories.length;
  } else if (range) {
    const value = getNumericValue(entity, fieldId);
    if (value == null) return null;
    normalized = range.max === range.min ? 0.5 : (value - range.min) / (range.max - range.min);
  }
  if (normalized == null) return null;
  const clamped = Math.min(1, Math.max(0, normalized));
  return invert
    ? pixelMax - clamped * (pixelMax - pixelMin)
    : pixelMin + clamped * (pixelMax - pixelMin);
};

type BuildBubblesOptions = {
  entities: EntityRecord[];
  config: BubbleConfig | null;
  xRange: { min: number; max: number } | null;
  yRange: { min: number; max: number } | null;
  sizeRange: { min: number; max: number } | null;
  xCategories: FieldOption[] | null;
  yCategories: FieldOption[] | null;
  colorCategories: FieldOption[];
  colorMap: Map<string, string>;
};

export const buildBubbles = ({
  entities,
  config,
  xRange,
  yRange,
  sizeRange,
  xCategories,
  yCategories,
  colorCategories,
  colorMap
}: BuildBubblesOptions): {
  bubbles: Bubble[];
  clusterBadges: { cx: number; cy: number; count: number }[];
} => {
  if (!config) return { bubbles: [], clusterBadges: [] };

  const raw = entities
    .map(entity => {
      const cx = positionOnBubbleAxis(
        entity,
        config.xFieldId,
        xRange,
        xCategories,
        MARGIN_LEFT,
        MARGIN_LEFT + PLOT_W,
        false
      );
      const cy = positionOnBubbleAxis(
        entity,
        config.yFieldId,
        yRange,
        yCategories,
        MARGIN_TOP,
        MARGIN_TOP + PLOT_H,
        true
      );
      if (cx == null || cy == null) return null;

      let radius = UNIFORM_R;
      if (config.sizeFieldId && sizeRange) {
        const value = getNumericValue(entity, config.sizeFieldId);
        if (value != null) {
          const normalized =
            sizeRange.max === sizeRange.min
              ? 0.5
              : (value - sizeRange.min) / (sizeRange.max - sizeRange.min);
          radius = MIN_R + Math.sqrt(Math.min(1, Math.max(0, normalized))) * (MAX_R - MIN_R);
        }
      }

      const colorValue = config.colorFieldId
        ? getCategoricalValue(entity, config.colorFieldId)
        : null;
      const color = config.colorFieldId
        ? colorValue != null
          ? (colorMap.get(colorValue) ?? UNIFORM_COLOR)
          : UNIFORM_COLOR
        : UNIFORM_COLOR;

      return {
        id: entity._uid,
        name: entity._name ?? entity._slug,
        description: entity._description ?? '',
        schemaName: entity._schema?.name ?? '',
        colorValue,
        cx,
        cy,
        r: radius,
        color,
        clusterCount: 1,
        xDisplay: formatAxisValue(entity, config.xFieldId, xCategories) ?? '—',
        yDisplay: formatAxisValue(entity, config.yFieldId, yCategories) ?? '—',
        sizeDisplay: config.sizeFieldId ? formatAxisValue(entity, config.sizeFieldId, null) : null,
        colorDisplay:
          colorValue != null
            ? (colorCategories.find(category => category.id === colorValue)?.label ?? colorValue)
            : null
      } satisfies Bubble;
    })
    .filter((bubble): bubble is Bubble => bubble != null);

  const buckets = new Map<string, Bubble[]>();
  raw.forEach(bubble => {
    const key = `${Math.round(bubble.cx / 8)}_${Math.round(bubble.cy / 8)}`;
    const list = buckets.get(key) ?? [];
    list.push(bubble);
    buckets.set(key, list);
  });

  const bubbles: Bubble[] = [];
  const clusterBadges: { cx: number; cy: number; count: number }[] = [];
  buckets.forEach(group => {
    if (group.length === 1) {
      bubbles.push(group[0]!);
      return;
    }
    const centerX = group.reduce((sum, bubble) => sum + bubble.cx, 0) / group.length;
    const centerY = group.reduce((sum, bubble) => sum + bubble.cy, 0) / group.length;
    const jitterRadius = 10 + 4 * Math.sqrt(group.length);
    clusterBadges.push({ cx: centerX, cy: centerY - jitterRadius - 8, count: group.length });
    group.forEach((bubble, index) => {
      const baseAngle = (2 * Math.PI * index) / group.length;
      const angleHash = stableHash(`${bubble.id}~jitter-angle`);
      const radiusHash = stableHash(`${bubble.id}~jitter-radius`);
      const angle =
        baseAngle + ((angleHash % 1000) / 1000 - 0.5) * ((2 * Math.PI) / group.length) * 0.9;
      const radius = jitterRadius * (0.55 + ((radiusHash % 1000) / 1000) * 0.7);
      bubbles.push({
        ...bubble,
        cx: centerX + radius * Math.cos(angle),
        cy: centerY + radius * Math.sin(angle),
        clusterCount: group.length
      });
    });
  });

  return { bubbles, clusterBadges };
};
