import { defineHandler } from 'h3';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { API_PREFIXES } from './constants';
import {
  allContracts as manifestAllContracts,
  contractSurfaceManifest
} from '@arch-register/api-types/contractSurfaceManifest';

export const allContracts = manifestAllContracts;

const { core, application, integration, diagramCraft, publicCatalog } =
  contractSurfaceManifest.surfaces;

type OpenAPIPaths = Record<string, unknown>;

const rewriteOpenAPIPaths = (spec: object, rewrites: readonly { from: string; to: string }[]) => {
  const rewriteBySource = new Map(rewrites.map(rewrite => [rewrite.from, rewrite.to]));
  const paths = Object.fromEntries(
    Object.entries((spec as { paths?: OpenAPIPaths }).paths ?? {}).map(([path, operations]) => [
      rewriteBySource.get(path) ?? path,
      operations
    ])
  );

  return { ...spec, paths };
};

const filterOpenAPIPaths = (spec: object, prefix: string) => {
  const paths = Object.fromEntries(
    Object.entries((spec as { paths?: OpenAPIPaths }).paths ?? {}).filter(([path]) =>
      path.startsWith(prefix)
    )
  );

  return { ...spec, paths };
};

let generatedUnifiedSpec: Promise<object> | null = null;
let generatedApplicationSpec: Promise<object> | null = null;
let generatedIntegrationSpec: Promise<object> | null = null;
let generatedDiagramCraftAdapterSpec: Promise<object> | null = null;
let generatedPublicCatalogSpec: Promise<object> | null = null;

export const getUnifiedOpenAPISpec = () => {
  generatedUnifiedSpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(core.contracts, {
    info: {
      title: 'Arch Register API',
      version: '1.0.0'
    },
    servers: [{ url: API_PREFIXES.root }]
  });

  return generatedUnifiedSpec;
};

export const getApplicationOpenAPISpec = () => {
  generatedApplicationSpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(application.contracts, {
    info: {
      title: 'Arch Register Application API',
      version: '1.0.0'
    },
    servers: [{ url: API_PREFIXES.application }]
  });

  return generatedApplicationSpec;
};

export const getPublicCatalogOpenAPISpec = () => {
  generatedPublicCatalogSpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(publicCatalog.contracts, {
    info: {
      title: 'Arch Register Public Catalog API',
      version: '1.0.0'
    },
    servers: [{ url: API_PREFIXES.publicCatalog }]
  });

  return generatedPublicCatalogSpec;
};

export const getIntegrationOpenAPISpec = () => {
  generatedIntegrationSpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  })
    .generate(integration.contracts, {
      info: {
        title: 'Arch Register Integration API',
        version: '1.0.0'
      },
      servers: [{ url: API_PREFIXES.root }]
    })
    .then(spec => rewriteOpenAPIPaths(spec, integration.openApiPathRewrites ?? []));

  return generatedIntegrationSpec;
};

export const getDiagramCraftAdapterOpenAPISpec = () => {
  generatedDiagramCraftAdapterSpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  })
    .generate(diagramCraft.contracts, {
      info: {
        title: 'Diagram Craft Adapter API',
        version: '1.0.0'
      },
      servers: [{ url: API_PREFIXES.root }]
    })
    .then(spec => filterOpenAPIPaths(spec, diagramCraft.openApiPathPrefix ?? ''));

  return generatedDiagramCraftAdapterSpec;
};

const createOpenAPISpecHandler = (getSpec: () => Promise<object>) =>
  defineHandler(async () => Response.json(await getSpec()));

export const createUnifiedOpenAPISpecHandler = () =>
  createOpenAPISpecHandler(getUnifiedOpenAPISpec);

export const createApplicationOpenAPISpecHandler = () =>
  createOpenAPISpecHandler(getApplicationOpenAPISpec);

export const createPublicCatalogOpenAPISpecHandler = () =>
  createOpenAPISpecHandler(getPublicCatalogOpenAPISpec);

export const createIntegrationOpenAPISpecHandler = () =>
  createOpenAPISpecHandler(getIntegrationOpenAPISpec);

export const createDiagramCraftAdapterOpenAPISpecHandler = () =>
  createOpenAPISpecHandler(getDiagramCraftAdapterOpenAPISpec);
