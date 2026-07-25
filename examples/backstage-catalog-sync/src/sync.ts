import type { Config } from './config.js';
import { listRepos, fetchCatalogInfo, type GitHubRepo } from './github.js';
import {
  parseBackstageYaml,
  validateEntity,
  isSupportedKind,
  generateExternalKey,
  type BackstageEntity
} from './backstage.js';
import { mapBackstageToArchRegister } from './mapper.js';
import { syncEntity, discoverSchemas } from './archRegister.js';

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
}

export interface EntitySyncResult {
  repo: string;
  entity: string;
  externalKey: string;
  status: 'created' | 'updated' | 'unchanged' | 'skipped' | 'failed';
  reason?: string;
}

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
    errors: []
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

  // Process each repository
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

      // Sync to Arch Register (unless dry run)
      if (config.dryRun) {
        console.log(`   ✓ Would sync: ${externalKey}`);
        report.unchanged++;
        continue;
      }

      try {
        const result = await syncEntity(
          config.archRegisterWorkspace,
          source,
          externalKey,
          mappingResult.entity,
          config.archRegisterToken,
          config.archRegisterUrl
        );

        switch (result.status) {
          case 'created':
            console.log(`   ✓ Created: ${result.entity.publicId} (${result.entity.name})`);
            report.created++;
            break;
          case 'updated':
            console.log(`   ✓ Updated: ${result.entity.publicId} (${result.entity.name})`);
            report.updated++;
            break;
          case 'unchanged':
            if (config.verbose) {
              console.log(`   ✓ Unchanged: ${result.entity.publicId} (${result.entity.name})`);
            }
            report.unchanged++;
            break;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`   ✗ Sync failed: ${errorMsg}`);
        report.failed++;
        report.errors.push({
          repo: repo.fullName,
          entity: entityRef,
          error: errorMsg
        });
      }
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
