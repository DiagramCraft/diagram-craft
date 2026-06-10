import { defineHandler } from 'h3';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import {
  workspaceEnumContract,
  workspaceSchemaContract,
  workspaceEntityContract,
  workspaceViewContract,
  workspaceManagementContract,
  workspaceConfigContract,
  projectContract,
  auditContract,
  watchContract,
  searchContract,
  workspaceTemplateContract
} from '@arch-register/api-types';

export const allContracts = {
  ...workspaceEnumContract,
  ...workspaceSchemaContract,
  ...workspaceEntityContract,
  ...workspaceViewContract,
  ...workspaceManagementContract,
  ...workspaceConfigContract,
  ...projectContract,
  ...auditContract,
  ...watchContract,
  ...searchContract,
  ...workspaceTemplateContract
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
