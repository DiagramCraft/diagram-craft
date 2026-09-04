import type { Database as DatabaseType } from 'better-sqlite3';
import type { ProjectDatabase } from './projectDatabase';
import { SqliteAssessmentDatabase } from './sqliteAssessmentDatabase';
import { SqliteAssessmentResponseDatabase } from './sqliteAssessmentResponseDatabase';
import { SqliteContentNodeDatabase } from './sqliteContentNodeDatabase';
import { SqliteDiagramEntityRefDatabase } from './sqliteDiagramEntityRefDatabase';
import { SqliteMarkdownRevisionDatabase } from './sqliteMarkdownRevisionDatabase';
import { SqliteProjectCrudDatabase } from './sqliteProjectCrudDatabase';
import { SqliteProjectEntityDatabase } from './sqliteProjectEntityDatabase';
import { SqliteProjectMilestoneDatabase } from './sqliteProjectMilestoneDatabase';

export class SqliteProjectDatabase implements ProjectDatabase {
  readonly projects: SqliteProjectCrudDatabase;
  readonly contentNodes: SqliteContentNodeDatabase;
  readonly markdownRevisions: SqliteMarkdownRevisionDatabase;
  readonly projectEntities: SqliteProjectEntityDatabase;
  readonly diagramEntityRefs: SqliteDiagramEntityRefDatabase;
  readonly assessments: SqliteAssessmentDatabase;
  readonly milestones: SqliteProjectMilestoneDatabase;
  readonly assessmentResponses: SqliteAssessmentResponseDatabase;

  constructor(getDb: () => DatabaseType) {
    this.projects = new SqliteProjectCrudDatabase(getDb);
    this.contentNodes = new SqliteContentNodeDatabase(getDb);
    this.markdownRevisions = new SqliteMarkdownRevisionDatabase(getDb);
    this.projectEntities = new SqliteProjectEntityDatabase(getDb);
    this.diagramEntityRefs = new SqliteDiagramEntityRefDatabase(getDb);
    this.assessments = new SqliteAssessmentDatabase(getDb);
    this.milestones = new SqliteProjectMilestoneDatabase(getDb);
    this.assessmentResponses = new SqliteAssessmentResponseDatabase(getDb);
  }
}
