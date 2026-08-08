import type { GovernanceRegistry } from './governanceRegistry';
import { createEntityGovernanceRegistry } from '../catalog/entityChangeOperations';
import { createRelationGovernanceRegistry } from '../catalog/relationChangeOperations';
import { createDeprecationGovernanceRegistry } from '../catalog/entityDeprecationOperations';
import { createFieldDateReminderGovernanceRegistry } from '../catalog/fieldDateReminderJob';
import { createDocumentGovernanceRegistry } from '../document/documentWorkflowOperations';
import { createAssessmentGovernanceRegistry } from '../project/assessmentOperations';

/**
 * Builds the complete governance runtime registry for every process that evaluates cases.
 * Keeping this composition in one place prevents the API and job server from silently
 * supporting different workflow kinds.
 */
export const createApplicationGovernanceRegistry = (): GovernanceRegistry =>
  new Map([
    ...createEntityGovernanceRegistry(),
    ...createRelationGovernanceRegistry(),
    ...createDeprecationGovernanceRegistry(),
    ...createDocumentGovernanceRegistry(),
    ...createAssessmentGovernanceRegistry(),
    ...createFieldDateReminderGovernanceRegistry()
  ]);
