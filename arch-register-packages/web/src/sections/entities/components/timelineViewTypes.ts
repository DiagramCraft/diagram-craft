import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { FieldOption } from './entityFieldSources';
import {
  getDateValue as sharedGetDateValue,
  getRawDateValue as sharedGetRawDateValue
} from './entityFieldSources';

export type TimelineConfig = {
  startFieldId: string | null;
  endFieldId: string | null;
  groupBy: 'owner' | 'type' | 'snapshot' | 'project' | 'containment';
  zoom: 'month' | 'quarter' | 'year';
  showProjectLanes: boolean;
  showMilestones: boolean;
  showAutosaves: boolean;
};

export const TL_LABEL_W = 252;
export const TL_COL_W = { month: 76, quarter: 106, year: 142 } as const;

export const METADATA_DATE_FIELDS: FieldOption[] = [
  { id: '_targetLifecycleDate', label: 'Target Lifecycle Date' }
];

export const getTimelineConfigDefaults = (dateFields: FieldOption[]): TimelineConfig => ({
  startFieldId: dateFields[0]?.id ?? null,
  endFieldId: dateFields[1]?.id ?? dateFields[0]?.id ?? null,
  groupBy: 'snapshot',
  zoom: 'quarter',
  showProjectLanes: true,
  showMilestones: true,
  showAutosaves: true
});

export const getDateValue = (entity: EntityRecord, fieldId: string | null): Date | null =>
  fieldId ? sharedGetDateValue(entity, fieldId) : null;

export const getRawDateValue = (entity: EntityRecord, fieldId: string | null): unknown =>
  fieldId ? sharedGetRawDateValue(entity, fieldId) : null;
