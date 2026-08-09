import { databaseDate, type DatabaseRow } from '../../../db/rowMappers';
import type {
  ArtifactDiagnosticCategory,
  ArtifactSourceKind,
  ArtifactStatus,
  ArtifactType
} from '@arch-register/api-types/artifactContract';

export type ArtifactDiagnosticDb = {
  category: ArtifactDiagnosticCategory;
  message: string;
  timestamp: Date;
};

export type ArtifactDbResult = {
  id: string;
  workspace: string;
  entity_id: string;
  artifact_type: ArtifactType;
  kind: ArtifactSourceKind;
  location: string | null;
  media_type: string | null;
  status: ArtifactStatus;
  current_revision_id: string | null;
  last_attempt_at: Date | null;
  last_success_at: Date | null;
  diagnostic: ArtifactDiagnosticDb | null;
  created_at: Date;
  updated_at: Date;
};

export type ArtifactRevisionDbResult = {
  id: string;
  workspace: string;
  artifact_id: string;
  source_revision: string | null;
  checksum: string;
  media_type: string | null;
  content: string;
  created_at: Date;
};

export type ArtifactDbCreate = Omit<
  ArtifactDbResult,
  | 'current_revision_id'
  | 'last_attempt_at'
  | 'last_success_at'
  | 'diagnostic'
  | 'created_at'
  | 'updated_at'
> & {
  created_at: Date;
  updated_at: Date;
};

export type ArtifactDbUpdate = Partial<
  Pick<
    ArtifactDbResult,
    | 'status'
    | 'current_revision_id'
    | 'last_attempt_at'
    | 'last_success_at'
    | 'diagnostic'
    | 'updated_at'
  >
>;

export type ArtifactRevisionDbCreate = Omit<ArtifactRevisionDbResult, 'created_at'> & {
  created_at: Date;
};

export const artifactMappers = {
  artifact: (row: DatabaseRow): ArtifactDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    artifact_type: String(row['artifact_type']) as ArtifactType,
    kind: String(row['kind']) as ArtifactSourceKind,
    location: row['location'] == null ? null : String(row['location']),
    media_type: row['media_type'] == null ? null : String(row['media_type']),
    status: String(row['status']) as ArtifactStatus,
    current_revision_id:
      row['current_revision_id'] == null ? null : String(row['current_revision_id']),
    last_attempt_at: row['last_attempt_at'] == null ? null : databaseDate(row['last_attempt_at']),
    last_success_at: row['last_success_at'] == null ? null : databaseDate(row['last_success_at']),
    diagnostic:
      row['diagnostic_category'] == null
        ? null
        : {
            category: String(row['diagnostic_category']) as ArtifactDiagnosticCategory,
            message: String(row['diagnostic_message'] ?? ''),
            timestamp: databaseDate(row['diagnostic_timestamp'])
          },
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  revision: (row: DatabaseRow): ArtifactRevisionDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    artifact_id: String(row['artifact_id']),
    source_revision: row['source_revision'] == null ? null : String(row['source_revision']),
    checksum: String(row['checksum']),
    media_type: row['media_type'] == null ? null : String(row['media_type']),
    content: String(row['content']),
    created_at: databaseDate(row['created_at'])
  })
};

export type ArtifactDatabase = {
  listArtifacts(workspace: string, entityId: string): Promise<ArtifactDbResult[]>;
  getArtifact(workspace: string, id: string): Promise<ArtifactDbResult | null>;
  createArtifact(input: ArtifactDbCreate): Promise<ArtifactDbResult>;
  updateArtifact(
    workspace: string,
    id: string,
    input: ArtifactDbUpdate
  ): Promise<ArtifactDbResult | null>;
  getRevision(workspace: string, id: string): Promise<ArtifactRevisionDbResult | null>;
  getRevisionByChecksum(
    workspace: string,
    artifactId: string,
    checksum: string
  ): Promise<ArtifactRevisionDbResult | null>;
  createRevision(input: ArtifactRevisionDbCreate): Promise<ArtifactRevisionDbResult>;
};
