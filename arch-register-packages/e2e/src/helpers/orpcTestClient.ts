import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { projectContract } from '@arch-register/api-types/projectContract';
import { authPublicContract, authProtectedContract } from '@arch-register/api-types/authContract';
import { workspaceEntityContract } from '@arch-register/api-types/entityContract';
import { workspaceEnumContract } from '@arch-register/api-types/enumContract';
import { workspaceSchemaContract } from '@arch-register/api-types/schemaContract';
import { searchContract } from '@arch-register/api-types/searchContract';
import { workspaceTemplateContract } from '@arch-register/api-types/templateContract';
import { workspaceViewContract } from '@arch-register/api-types/viewContract';
import { workspaceManagementContract } from '@arch-register/api-types/workspaceContract';
import { workspaceConfigContract } from '@arch-register/api-types/workspaceConfigContract';
import { auditContract } from '@arch-register/api-types/auditContract';
import { aiContract } from '@arch-register/api-types/aiContract';
import { diagramCraftContract } from '@arch-register/api-types/diagramCraftContract';

const makeFetch =
  (auth?: string) =>
  async (request: Request, init?: RequestInit): Promise<Response> => {
    const method = request.method;
    const body =
      method === 'GET' || method === 'HEAD' ? undefined : await request.clone().arrayBuffer();
    const headers = new Headers(request.headers);
    if (auth) headers.set('Authorization', auth);
    return fetch(request.url, { ...init, method, headers, body });
  };

const makeClient = <T extends AnyContractRouter>(contract: T, baseUrl: string, auth?: string) =>
  createORPCClient(
    new OpenAPILink(contract, { url: `${baseUrl}/api`, fetch: makeFetch(auth) })
  ) as JsonifiedClient<ContractRouterClient<T>>;

export const createTestORPCClient = (baseUrl: string, auth?: string) => {
  const make = <T extends AnyContractRouter>(contract: T) => makeClient(contract, baseUrl, auth);

  return {
    projects: make(projectContract).projects,
    auth: make(authPublicContract).auth,
    authProtected: make(authProtectedContract).authProtected,
    entities: make(workspaceEntityContract).entities,
    enums: make(workspaceEnumContract).enums,
    schemas: make(workspaceSchemaContract).schemas,
    search: make(searchContract).search,
    templates: make(workspaceTemplateContract).templates,
    views: make(workspaceViewContract).views,
    workspaces: make(workspaceManagementContract).workspaces,
    config: make(workspaceConfigContract).config,
    audit: make(auditContract).audit,
    ai: make(aiContract).ai,
    diagramCraft: make(diagramCraftContract).diagramCraft
  };
};

export type TestORPCClient = ReturnType<typeof createTestORPCClient>;
