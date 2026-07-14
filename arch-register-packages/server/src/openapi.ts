import { defineHandler } from 'h3';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { workspaceSchemaContract } from '@arch-register/api-types/schemaContract';
import { workspaceEnumContract } from '@arch-register/api-types/enumContract';
import { workspaceEntityContract } from '@arch-register/api-types/entityContract';
import { workspaceViewContract } from '@arch-register/api-types/viewContract';
import { workspaceCollectionContract } from '@arch-register/api-types/collectionContract';
import { workspaceManagementContract } from '@arch-register/api-types/workspaceContract';
import { workspaceConfigContract } from '@arch-register/api-types/workspaceConfigContract';
import { projectContract } from '@arch-register/api-types/projectContract';
import { auditContract } from '@arch-register/api-types/auditContract';
import { watchContract } from '@arch-register/api-types/watchContract';
import { searchContract } from '@arch-register/api-types/searchContract';
import { workspaceTemplateContract } from '@arch-register/api-types/templateContract';
import { authProtectedContract, authPublicContract } from '@arch-register/api-types/authContract';
import { aiContract } from '@arch-register/api-types/aiContract';
import { diagramCraftContract } from '@arch-register/api-types/diagramCraftContract';
import { workspaceAnalyticsContract } from '@arch-register/api-types/analyticsContract';

export const allContracts = {
  ...workspaceEnumContract,
  ...workspaceSchemaContract,
  ...workspaceEntityContract,
  ...workspaceViewContract,
  ...workspaceCollectionContract,
  ...workspaceManagementContract,
  ...workspaceConfigContract,
  ...projectContract,
  ...auditContract,
  ...watchContract,
  ...searchContract,
  ...workspaceTemplateContract,
  ...authPublicContract,
  ...authProtectedContract,
  ...aiContract,
  ...diagramCraftContract,
  ...workspaceAnalyticsContract
};

let generatedUnifiedSpec: Promise<object> | null = null;

export const getUnifiedOpenAPISpec = () => {
  generatedUnifiedSpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(allContracts, {
    info: {
      title: 'Arch Register API',
      version: '1.0.0'
    },
    servers: [{ url: '/api' }]
  });

  return generatedUnifiedSpec;
};

export const createUnifiedOpenAPISpecHandler = () =>
  defineHandler(async () => Response.json(await getUnifiedOpenAPISpec()));
