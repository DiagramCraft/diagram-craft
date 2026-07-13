import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { getCategoricalValue } from './entityFieldSources';
import { stableHash } from './stableHash';

export type Quadrant = {
  value: string;
  label: string;
  startAngle: number;
  endAngle: number;
  color: string;
};

export type Ring = {
  value: string;
  label: string;
  innerR: number;
  outerR: number;
  color: string;
};

export type Blip = {
  id: string;
  name: string;
  description: string;
  quadrantValue: string;
  ringValue: string;
  num: number;
  x: number;
  y: number;
};

export const CX = 420;
export const CY = 420;
export const MAX_R = 385;

export const QUADRANT_COLORS = [
  'var(--tag-api)',
  'var(--tag-component)',
  'var(--tag-database)',
  'var(--tag-system)',
  'var(--tag-service)',
  'var(--accent-fg)',
  'var(--warning-fg)',
  'oklch(0.62 0.14 180)'
];

export const RING_COLORS = [
  'var(--tag-component)',
  'var(--accent-fg)',
  'var(--tag-system)',
  'var(--warning-fg)',
  'var(--tag-service)'
];

export const RING_BG = [
  'var(--cmp-bg-hover)',
  'var(--cmp-bg)',
  'var(--panel-bg)',
  'var(--base-bg)',
  'oklch(0.12 0.005 260)'
];

export const buildQuadrants = (values: Array<{ value: string; label: string }>): Quadrant[] => {
  const count = Math.min(values.length, 8);
  return values.slice(0, count).map((value, index) => ({
    value: value.value,
    label: value.label,
    startAngle: (index / count) * 2 * Math.PI - Math.PI / 2,
    endAngle: ((index + 1) / count) * 2 * Math.PI - Math.PI / 2,
    color: QUADRANT_COLORS[index % QUADRANT_COLORS.length]!
  }));
};

export const buildRings = (values: Array<{ value: string; label: string }>): Ring[] => {
  const count = Math.min(values.length, 5);
  return values.slice(0, count).map((value, index) => ({
    value: value.value,
    label: value.label,
    innerR: (index / count) * MAX_R,
    outerR: ((index + 1) / count) * MAX_R,
    color: RING_COLORS[index % RING_COLORS.length]!
  }));
};

export const getBlipXY = (
  entityId: string,
  quadrant: Quadrant,
  ring: Ring
): { x: number; y: number } => {
  const h1 = stableHash(`${entityId}~a`);
  const h2 = stableHash(`${entityId}~b`);
  const angleSpread = (quadrant.endAngle - quadrant.startAngle) * 0.78;
  const angle =
    quadrant.startAngle +
    (quadrant.endAngle - quadrant.startAngle) * 0.11 +
    ((h1 % 9973) / 9973) * angleSpread;
  const radiusMin = ring.innerR < 10 ? 14 : ring.innerR + 10;
  const radiusMax = ring.outerR - 10;
  const radius = radiusMin + ((h2 % 9871) / 9871) * (radiusMax - radiusMin);
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
};

export const buildBlips = (
  entities: EntityRecord[],
  quadrantFieldId: string,
  ringFieldId: string,
  quadrants: Quadrant[],
  rings: Ring[]
): Blip[] => {
  const quadrantMap = new Map(quadrants.map(quadrant => [quadrant.value, quadrant]));
  const ringMap = new Map(rings.map(ring => [ring.value, ring]));
  const valid = entities.filter(entity => {
    const quadrantValue = getCategoricalValue(entity, quadrantFieldId);
    const ringValue = getCategoricalValue(entity, ringFieldId);
    return (
      quadrantValue != null &&
      ringValue != null &&
      quadrantMap.has(quadrantValue) &&
      ringMap.has(ringValue)
    );
  });
  const quadrantIndex = new Map(quadrants.map((quadrant, index) => [quadrant.value, index]));
  const ringIndex = new Map(rings.map((ring, index) => [ring.value, index]));

  valid.sort((left, right) => {
    const leftQuadrant = quadrantIndex.get(getCategoricalValue(left, quadrantFieldId)!) ?? 0;
    const rightQuadrant = quadrantIndex.get(getCategoricalValue(right, quadrantFieldId)!) ?? 0;
    if (leftQuadrant !== rightQuadrant) return leftQuadrant - rightQuadrant;
    const leftRing = ringIndex.get(getCategoricalValue(left, ringFieldId)!) ?? 0;
    const rightRing = ringIndex.get(getCategoricalValue(right, ringFieldId)!) ?? 0;
    if (leftRing !== rightRing) return leftRing - rightRing;
    return (left._name ?? '').localeCompare(right._name ?? '');
  });

  return valid.map((entity, index) => {
    const quadrantValue = getCategoricalValue(entity, quadrantFieldId)!;
    const ringValue = getCategoricalValue(entity, ringFieldId)!;
    const quadrant = quadrantMap.get(quadrantValue)!;
    const ring = ringMap.get(ringValue)!;
    return {
      id: entity._uid,
      name: entity._name ?? entity._slug,
      description: entity._description ?? '',
      quadrantValue,
      ringValue,
      num: index + 1,
      ...getBlipXY(entity._uid, quadrant, ring)
    };
  });
};
