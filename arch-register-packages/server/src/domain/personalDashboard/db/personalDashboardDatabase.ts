import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { databaseDate, parseDatabaseJson } from '../../../db/rowMappers';

export type UserDashboardDbResult = {
  id: string;
  user_id: string;
  workspace: string;
  name: string;
  sort_order: number;
  layout: DashboardWidget[];
  updated_at: Date;
};

export const mapUserDashboardRow = (row: Record<string, unknown>): UserDashboardDbResult => ({
  id: String(row['id']),
  user_id: String(row['user_id']),
  workspace: String(row['workspace']),
  name: String(row['name']),
  sort_order: Number(row['sort_order']),
  layout: parseDatabaseJson<DashboardWidget[]>(row['layout'], [], 'user_dashboard.layout'),
  updated_at: databaseDate(row['updated_at'])
});

export type PersonalDashboardDbCreate = {
  id: string;
  user_id: string;
  workspace: string;
  name: string;
  sort_order: number;
};

export type PersonalDashboardDbUpdate = {
  name?: string;
  layout?: DashboardWidget[];
};

export type PersonalDashboardDatabase = {
  list(userId: string, workspace: string): Promise<UserDashboardDbResult[]>;
  get(userId: string, workspace: string, id: string): Promise<UserDashboardDbResult | null>;
  create(input: PersonalDashboardDbCreate): Promise<UserDashboardDbResult>;
  update(
    userId: string,
    workspace: string,
    id: string,
    input: PersonalDashboardDbUpdate
  ): Promise<UserDashboardDbResult | null>;
  remove(userId: string, workspace: string, id: string): Promise<UserDashboardDbResult | null>;
};
