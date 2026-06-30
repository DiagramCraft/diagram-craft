import type { EntityRecord } from '@arch-register/api-types/entityContract';

export type EntityBrowserRowViewProps = {
  rows: EntityRecord[];
  linkedEntityIds?: string[];
  onEntityClick: (entityId: string) => void;
};
