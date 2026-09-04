import type { PostgresQueryClient } from '../../../db/postgresBase';
import type { ProjectDatabase } from './projectDatabase';
import { PostgresAssessmentDatabase } from './postgresAssessmentDatabase';
import { PostgresAssessmentResponseDatabase } from './postgresAssessmentResponseDatabase';
import { PostgresContentNodeDatabase } from './postgresContentNodeDatabase';
import { PostgresDiagramEntityRefDatabase } from './postgresDiagramEntityRefDatabase';
import { PostgresMarkdownRevisionDatabase } from './postgresMarkdownRevisionDatabase';
import { PostgresProjectCrudDatabase } from './postgresProjectCrudDatabase';
import { PostgresProjectEntityDatabase } from './postgresProjectEntityDatabase';
import { PostgresProjectMilestoneDatabase } from './postgresProjectMilestoneDatabase';

export class PostgresProjectDatabase implements ProjectDatabase {
  readonly projects: PostgresProjectCrudDatabase;
  readonly contentNodes: PostgresContentNodeDatabase;
  readonly markdownRevisions: PostgresMarkdownRevisionDatabase;
  readonly projectEntities: PostgresProjectEntityDatabase;
  readonly diagramEntityRefs: PostgresDiagramEntityRefDatabase;
  readonly assessments: PostgresAssessmentDatabase;
  readonly milestones: PostgresProjectMilestoneDatabase;
  readonly assessmentResponses: PostgresAssessmentResponseDatabase;

  constructor(sql: PostgresQueryClient) {
    this.projects = new PostgresProjectCrudDatabase(sql);
    this.contentNodes = new PostgresContentNodeDatabase(sql);
    this.markdownRevisions = new PostgresMarkdownRevisionDatabase(sql);
    this.projectEntities = new PostgresProjectEntityDatabase(sql);
    this.diagramEntityRefs = new PostgresDiagramEntityRefDatabase(sql);
    this.assessments = new PostgresAssessmentDatabase(sql);
    this.milestones = new PostgresProjectMilestoneDatabase(sql);
    this.assessmentResponses = new PostgresAssessmentResponseDatabase(sql);
  }
}
