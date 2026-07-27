import type { Config } from './config.js';
import { listRepos, fetchCatalogInfo, type GitHubRepo } from './github.js';
import {
  parseBackstageYaml,
  validateEntity,
  isSupportedKind,
  generateExternalKey,
  parseBackstageReference,
  canonicalReferenceKey,
  type BackstageEntity
} from './backstage.js';
import { mapBackstageToArchRegister } from './mapper.js';
import { syncEntity, getEntityByExternalKey, discoverSchemas, type SyncResult } from './archRegister.js';

export interface SyncReport {
  totalRepos: number;
  totalEntities: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  errors: Array<{
    repo: string;
    entity?: string;
    error: string;
  }>;
  warnings: Array<{
    repo: string;
    entity: string;
    field: string;
    reference: string;
    warning: string;
  }>;
}

interface ScannedEntity {
  repo: GitHubRepo;
  entity: BackstageEntity;
  entityRef: string;
  externalKey: string;
  mapped: NonNullable<ReturnType<typeof mapBackstageToArchRegister>['entity']>;
  relationships: ReturnType<typeof mapBackstageToArchRegister>['relationships'];
}

const relationFieldName = (field: string): string => {
  switch (field) {
    case 'providesApis': return 'provides_apis';
    case 'consumesApis': return 'consumes_apis';
    default: return field;
  }
};

const relationFieldsForKind = (kind: string): string[] => {
  switch (kind) {
    case 'Component': return ['system', 'provides_apis', 'consumes_apis'];
    case 'API':
    case 'Resource': return ['system'];
    case 'System': return ['domain'];
    default: return [];
  }
};

const referenceDisplay = (reference: unknown): string =>
  typeof reference === 'string' ? reference : JSON.stringify(reference) ?? String(reference);

/**
 * Syncs all Backstage catalog-info.yaml files from a GitHub organization
 */
export const syncOrganization = async (org: string, config: Config): Promise<SyncReport> => {
  const report: SyncReport = {
    totalRepos: 0,
    totalEntities: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    warnings: []
  };

  console.log(`\n🔍 Scanning GitHub organization: ${org}`);
  console.log(`   Arch Register: ${config.archRegisterUrl}`);
  console.log(`   Workspace: ${config.archRegisterWorkspace}`);
  if (config.dryRun) {
    console.log(`   ⚠️  DRY RUN MODE - No changes will be made\n`);
  }

  // Auto-discover schemas if not provided
  const schemaMapping = { ...config.schemaMapping };
  const missingSchemas = Object.entries(schemaMapping).filter(([_, id]) => !id);

  if (missingSchemas.length > 0) {
    console.log('🔎 Auto-discovering schema IDs...');
    try {
      const discovered = await discoverSchemas(
        config.archRegisterWorkspace,
        config.archRegisterToken,
        config.archRegisterUrl
      );

      for (const [kind, id] of Object.entries(discovered)) {
        if (!schemaMapping[kind as keyof typeof schemaMapping]) {
          schemaMapping[kind as keyof typeof schemaMapping] = id;
          console.log(`   ✓ Found ${kind}: ${id}`);
        }
      }
    } catch (error) {
      console.error(
        `   ✗ Schema discovery failed: ${error instanceof Error ? error.message : String(error)}`
      );
      report.errors.push({
        repo: 'schema-discovery',
        error: error instanceof Error ? error.message : String(error)
      });
      return report;
    }
  }

  // List all repositories
  let repos: GitHubRepo[];
  try {
    repos = await listRepos(org, config.githubToken);
    report.totalRepos = repos.length;
    console.log(`\n📦 Found ${repos.length} repositories\n`);
  } catch (error) {
    console.error(
      `✗ Failed to list repositories: ${error instanceof Error ? error.message : String(error)}`
    );
    report.errors.push({
      repo: 'github-api',
      error: error instanceof Error ? error.message : String(error)
    });
    return report;
  }

  const scanned: ScannedEntity[] = [];

  // Scan every repository and entity before making any writes. This makes references independent
  // of GitHub's repository/entity ordering.
  const source = `backstage-github-${org}`;

  for (const repo of repos) {
    if (config.verbose) {
      console.log(`\n📂 Processing ${repo.fullName}...`);
    }

    // Fetch catalog-info.yaml
    let catalogContent: string | null;
    try {
      catalogContent = await fetchCatalogInfo(repo, config.githubToken);

      if (!catalogContent) {
        if (config.verbose) {
          console.log(`   ⊘ No catalog-info.yaml found`);
        }
        continue;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ✗ Failed to fetch catalog-info.yaml: ${errorMsg}`);
      report.errors.push({
        repo: repo.fullName,
        error: errorMsg
      });
      continue;
    }

    // Parse YAML
    let entities: BackstageEntity[];
    try {
      entities = parseBackstageYaml(catalogContent);

      if (entities.length === 0) {
        if (config.verbose) {
          console.log(`   ⊘ No entities found in catalog-info.yaml`);
        }
        continue;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ✗ Failed to parse YAML: ${errorMsg}`);
      report.errors.push({
        repo: repo.fullName,
        error: errorMsg
      });
      continue;
    }

    // Process each entity
    for (const entity of entities) {
      report.totalEntities++;
      const entityRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;

      if (config.verbose) {
        console.log(`\n   📄 Entity: ${entityRef}`);
      }

      // Validate entity
      const validation = validateEntity(entity);
      if (!validation.valid) {
        console.error(`   ✗ Validation failed: ${validation.errors.join(', ')}`);
        report.failed++;
        report.errors.push({
          repo: repo.fullName,
          entity: entityRef,
          error: `Validation failed: ${validation.errors.join(', ')}`
        });
        continue;
      }

      // Check if kind is supported
      if (!isSupportedKind(entity.kind)) {
        if (config.verbose) {
          console.log(`   ⊘ Skipped: Unsupported kind '${entity.kind}'`);
        }
        report.skipped++;
        continue;
      }

      // Map to Arch Register format
      const mappingResult = mapBackstageToArchRegister(entity, schemaMapping);

      if (mappingResult.errors.length > 0) {
        console.error(`   ✗ Mapping failed: ${mappingResult.errors.join(', ')}`);
        report.failed++;
        report.errors.push({
          repo: repo.fullName,
          entity: entityRef,
          error: `Mapping failed: ${mappingResult.errors.join(', ')}`
        });
        continue;
      }

      if (mappingResult.warnings.length > 0 && config.verbose) {
        for (const warning of mappingResult.warnings) {
          console.log(`   ⚠️  ${warning}`);
        }
      }

      if (!mappingResult.entity) {
        console.error(`   ✗ Mapping produced no entity`);
        report.failed++;
        report.errors.push({
          repo: repo.fullName,
          entity: entityRef,
          error: 'Mapping produced no entity'
        });
        continue;
      }

      // Generate external key
      const externalKey = generateExternalKey(entity);

      scanned.push({
        repo,
        entity,
        entityRef,
        externalKey,
        mapped: mappingResult.entity,
        relationships: mappingResult.relationships
      });
    }
  }

  if (config.dryRun) {
    for (const item of scanned) {
      console.log(`   ✓ Would sync: ${item.externalKey}`);
      report.unchanged++;
    }
    return report;
  }

  const idsByReference = new Map<string, string>();
  const existingByKey = new Map<string, Record<string, unknown>>();
  const syncResults = new Map<string, SyncResult>();
  // Pass one: materialize scalar fields, retaining existing relationship values until all IDs
  // are known. New entities get empty arrays for every supported relation field.
  for (const item of scanned) {
    let existing: Record<string, unknown> | undefined;
    const relationFields = relationFieldsForKind(item.entity.kind);
    try {
      existing = await getEntityByExternalKey(
        config.archRegisterWorkspace, source, item.externalKey,
        config.archRegisterToken, config.archRegisterUrl
      );
      existingByKey.set(item.externalKey, existing);
    } catch (error) {
      if (!(error instanceof Error && 'status' in error && (error as { status?: number }).status === 404)) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        report.failed++;
        report.errors.push({ repo: item.repo.fullName, entity: item.entityRef, error: errorMsg });
        continue;
      }
    }

    const materialized = { ...item.mapped };
    for (const field of relationFields) {
      materialized[field] = existing?.[field] ?? [];
    }

    try {
      const result = await syncEntity(
        config.archRegisterWorkspace, source, item.externalKey, materialized,
        config.archRegisterToken, config.archRegisterUrl
      );
      syncResults.set(item.externalKey, result);
      idsByReference.set(canonicalReferenceKey({
        kind: item.entity.kind,
        namespace: item.entity.metadata.namespace ?? 'default',
        name: item.entity.metadata.name
      }), result.entity._uid);
      switch (result.status) {
        case 'created': report.created++; break;
        case 'updated': report.updated++; break;
        case 'unchanged': report.unchanged++; break;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      report.failed++;
      report.errors.push({ repo: item.repo.fullName, entity: item.entityRef, error: errorMsg });
    }
  }

  const lookupCache = new Map<string, string | null>();
  const resolveReference = async (key: string): Promise<string | null> => {
    if (idsByReference.has(key)) return idsByReference.get(key)!;
    if (lookupCache.has(key)) return lookupCache.get(key)!;
    try {
      const target = await getEntityByExternalKey(
        config.archRegisterWorkspace, source, key,
        config.archRegisterToken, config.archRegisterUrl
      );
      lookupCache.set(key, target._uid);
      return target._uid;
    } catch (error) {
      if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 404) {
        lookupCache.set(key, null);
        return null;
      }
      throw error;
    }
  };

  // Pass two: resolve and submit only changed relationship arrays.
  for (const item of scanned) {
    if (!syncResults.has(item.externalKey)) continue;
    const relationFields = relationFieldsForKind(item.entity.kind);
    const relationValues = new Map<string, string[]>();
    for (const relationship of item.relationships) {
      const field = relationFieldName(relationship.field);
      const resolved: string[] = [];
      for (const original of relationship.references) {
        const parsed = parseBackstageReference(original, relationship.defaultKind);
        const key = parsed && ['component', 'api', 'resource', 'system', 'domain'].includes(parsed.kind)
          ? canonicalReferenceKey(parsed)
          : null;
        let id: string | null = null;
        try {
          id = key ? await resolveReference(key) : null;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          report.failed++;
          report.errors.push({ repo: item.repo.fullName, entity: item.entityRef, error: errorMsg });
          continue;
        }
        if (id) {
          resolved.push(id);
        } else {
          const warning = `Unresolved relationship target for ${item.entityRef}.${relationship.field}: ${referenceDisplay(original)}`;
          report.warnings.push({ repo: item.repo.fullName, entity: item.entityRef, field: relationship.field, reference: referenceDisplay(original), warning });
          if (config.verbose) console.log(`   ⚠️  ${warning}`);
        }
      }
      relationValues.set(field, [...new Set(resolved)].sort());
    }

    const current = existingByKey.get(item.externalKey) ?? {};
    const changedFields: Record<string, unknown> = {};
    for (const [field, values] of relationValues) {
      const currentValues = Array.isArray(current[field]) ? [...current[field] as unknown[]].map(String).sort() : [];
      if (JSON.stringify(currentValues) !== JSON.stringify(values)) changedFields[field] = values;
    }
    if (Object.keys(changedFields).length === 0) continue;

    const relationshipPayload = Object.fromEntries(
      relationFields.map(field => [field, relationValues.get(field) ?? current[field] ?? []])
    );

    try {
      await syncEntity(
        config.archRegisterWorkspace, source, item.externalKey,
        { ...item.mapped, ...relationshipPayload },
        config.archRegisterToken, config.archRegisterUrl
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      report.failed++;
      report.errors.push({ repo: item.repo.fullName, entity: item.entityRef, error: errorMsg });
    }
  }

  return report;
};

/**
 * Prints a summary report of the sync operation
 */
export const printReport = (report: SyncReport): void => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Sync Report');
  console.log('='.repeat(60));
  console.log(`Repositories scanned: ${report.totalRepos}`);
  console.log(`Entities found: ${report.totalEntities}`);
  console.log(`  ✓ Created: ${report.created}`);
  console.log(`  ✓ Updated: ${report.updated}`);
  console.log(`  ✓ Unchanged: ${report.unchanged}`);
  console.log(`  ⊘ Skipped: ${report.skipped}`);
  console.log(`  ✗ Failed: ${report.failed}`);

  if (report.warnings.length > 0) {
    console.log('\n⚠️  Relationship warnings:');
    for (const warning of report.warnings) console.log(`  • ${warning.repo} / ${warning.entity}\n    ${warning.warning}`);
  }

  if (report.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const error of report.errors) {
      if (error.entity) {
        console.log(`  • ${error.repo} / ${error.entity}`);
      } else {
        console.log(`  • ${error.repo}`);
      }
      console.log(`    ${error.error}`);
    }
  }

  console.log(`${'='.repeat(60)}\n`);
};
