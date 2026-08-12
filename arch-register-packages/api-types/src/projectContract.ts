import { oc } from '@orpc/contract';
import {
  projectContentProjectContract,
  projectContentScopedContract
} from './projectContentContract';
import { projectCrudContract } from './projectCrudContract';
import { projectDocumentAiContract } from './projectDocumentAiContract';
import {
  projectDocumentDiscoveryListContract,
  projectDocumentDiscoveryRelatedContract
} from './projectDocumentDiscoveryContract';
import { projectEntityContract } from './projectEntityContract';
import { projectMarkdownContract } from './projectMarkdownContract';

export const projectContract = oc.tag('Projects').router({
  projects: {
    ...projectCrudContract,
    ...projectContentProjectContract,
    ...projectEntityContract,
    ...projectContentScopedContract,
    ...projectMarkdownContract,
    ...projectDocumentDiscoveryRelatedContract,
    ...projectDocumentAiContract,
    ...projectDocumentDiscoveryListContract
  }
});
