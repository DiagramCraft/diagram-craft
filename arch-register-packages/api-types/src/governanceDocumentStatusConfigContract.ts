import { oc } from '@orpc/contract';
import { z } from 'zod';
import { wsAndId } from '@arch-register/api-types/common';
import {
  documentStatusApprovalConfigSchema,
  documentStatusApprovalSchema
} from './governanceCaseConfigSchemas';

const documentStatusConfigSchema = z.object({
  document_type_id: z.string(),
  field_id: z.string(),
  case_subkind: z.string(),
  enabled: z.boolean(),
  config: documentStatusApprovalConfigSchema
});

const documentStatusConfigUpdateSchema = z.object({
  enabled: z.boolean(),
  statuses: z.record(z.string(), documentStatusApprovalSchema)
});

export const governanceDocumentStatusConfigContract = oc.tag('Governance').router({
  governanceDocumentStatusConfig: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/governance/document-status-config/{id}',
        inputStructure: 'detailed',
        summary: 'List document status approval configuration',
        tags: ['Governance']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.array(documentStatusConfigSchema)),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/governance/document-status-config/{id}/{fieldId}',
        inputStructure: 'detailed',
        summary: 'Update document status approval configuration',
        tags: ['Governance']
      })
      .input(
        z.object({
          params: wsAndId.extend({ fieldId: z.string().min(1) }),
          body: documentStatusConfigUpdateSchema
        })
      )
      .output(documentStatusConfigSchema)
  }
});

export type GovernanceDocumentStatusConfig = z.infer<typeof documentStatusConfigSchema>;
export type GovernanceDocumentStatusConfigUpdate = z.infer<typeof documentStatusConfigUpdateSchema>;
