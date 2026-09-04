import type { AssessmentDatabase } from './assessmentDatabase';
import type { AssessmentResponseDatabase } from './assessmentResponseDatabase';
import type { ContentNodeDatabase } from './contentNodeDatabase';
import type { DiagramEntityRefDatabase } from './diagramEntityRefDatabase';
import type { MarkdownRevisionDatabase } from './markdownRevisionDatabase';
import type { ProjectCrudDatabase } from './projectCrudDatabase';
import type { ProjectEntityDatabase } from './projectEntityDatabase';
import type { ProjectMilestoneDatabase } from './projectMilestoneDatabase';

export type ProjectDatabase = {
  projects: ProjectCrudDatabase;
  contentNodes: ContentNodeDatabase;
  markdownRevisions: MarkdownRevisionDatabase;
  projectEntities: ProjectEntityDatabase;
  diagramEntityRefs: DiagramEntityRefDatabase;
  assessments: AssessmentDatabase;
  milestones: ProjectMilestoneDatabase;
  assessmentResponses: AssessmentResponseDatabase;
};

export type {
  ProjectCrudDatabase,
  ProjectDbCreate,
  ProjectDbResult,
  ProjectDbUpdate
} from './projectCrudDatabase';
export type {
  ContentMetadataDbResult,
  ContentMetadataDbUpsert,
  ContentNodeDatabase,
  ContentNodeDbResult,
  ContentNodeDbUpsert
} from './contentNodeDatabase';
export type {
  MarkdownRevisionDatabase,
  MarkdownRevisionDbCreate,
  MarkdownRevisionDbResult
} from './markdownRevisionDatabase';
export type {
  EntityProjectDbResult,
  ProjectEntityDatabase,
  ProjectEntityDbCreate,
  ProjectEntityDbResult,
  ProjectEntityLinkDbResult
} from './projectEntityDatabase';
export type {
  DiagramEntityFileDbResult,
  DiagramEntityRefDatabase
} from './diagramEntityRefDatabase';
export type {
  AssessmentDatabase,
  AssessmentDbCreate,
  AssessmentDbResult,
  AssessmentDbUpdate
} from './assessmentDatabase';
export type {
  ProjectMilestoneDatabase,
  ProjectMilestoneDbCreate,
  ProjectMilestoneDbResult,
  ProjectMilestoneDbUpdate
} from './projectMilestoneDatabase';
export type {
  AssessmentResponseDatabase,
  AssessmentResponseDbResult,
  AssessmentResponseDbUpsert
} from './assessmentResponseDatabase';
