import { databaseBoolean, databaseDate, type DatabaseRow } from '../../../db/rowMappers';

export type EntityDeprecationAckStatus = 'open' | 'completed';

export type EntityDeprecationAckDbResult = {
  id: string;
  case_id: string;
  workspace: string;
  owner_team_id: string;
  assignment_id: string;
  status: EntityDeprecationAckStatus;
  actor_user_id: string | null;
  comment: string | null;
  planned_remediation: string | null;
  remediation_project_id: string | null;
  target_remediation_date: string | null;
  risk_accepted: boolean;
  created_at: Date;
  resolved_at: Date | null;
};

export type EntityDeprecationAckDbCreate = Omit<
  EntityDeprecationAckDbResult,
  | 'status'
  | 'actor_user_id'
  | 'comment'
  | 'planned_remediation'
  | 'remediation_project_id'
  | 'target_remediation_date'
  | 'risk_accepted'
  | 'resolved_at'
>;

export type EntityDeprecationAckDbCompletion = {
  actor_user_id: string;
  comment: string | null;
  planned_remediation: string | null;
  remediation_project_id: string | null;
  target_remediation_date: string | null;
  risk_accepted: boolean;
  resolved_at: Date;
};

export const entityDeprecationMappers = {
  ack: (row: DatabaseRow): EntityDeprecationAckDbResult => ({
    id: String(row['id']),
    case_id: String(row['case_id']),
    workspace: String(row['workspace']),
    owner_team_id: String(row['owner_team_id']),
    assignment_id: String(row['assignment_id']),
    status: row['status'] as EntityDeprecationAckStatus,
    actor_user_id: row['actor_user_id'] == null ? null : String(row['actor_user_id']),
    comment: row['comment'] == null ? null : String(row['comment']),
    planned_remediation:
      row['planned_remediation'] == null ? null : String(row['planned_remediation']),
    remediation_project_id:
      row['remediation_project_id'] == null ? null : String(row['remediation_project_id']),
    target_remediation_date:
      row['target_remediation_date'] == null ? null : String(row['target_remediation_date']),
    risk_accepted: databaseBoolean(row['risk_accepted']),
    created_at: databaseDate(row['created_at']),
    resolved_at: row['resolved_at'] == null ? null : databaseDate(row['resolved_at'])
  })
};

export type EntityDeprecationDatabase = {
  createAck(input: EntityDeprecationAckDbCreate): Promise<EntityDeprecationAckDbResult>;
  listAcksForCase(caseId: string): Promise<EntityDeprecationAckDbResult[]>;
  getAckByAssignment(assignmentId: string): Promise<EntityDeprecationAckDbResult | null>;
  /** Conditional transition to 'completed'; returns null if the ack was not open. */
  completeAckIfOpen(
    assignmentId: string,
    completion: EntityDeprecationAckDbCompletion
  ): Promise<EntityDeprecationAckDbResult | null>;
};
