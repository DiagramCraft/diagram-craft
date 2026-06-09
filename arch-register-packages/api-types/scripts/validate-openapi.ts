#!/usr/bin/env tsx
/**
 * Validates that the OpenAPI schema matches the TypeScript types in @arch-register/api-types
 * 
 * This script performs basic structural validation to ensure the OpenAPI spec
 * stays in sync with the TypeScript type definitions.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type ValidationError = {
  path: string;
  message: string;
  severity: 'error' | 'warning';
};

const errors: ValidationError[] = [];

const addError = (path: string, message: string, severity: 'error' | 'warning' = 'error') => {
  errors.push({ path, message, severity });
};

// Load OpenAPI spec
const openApiPath = resolve(__dirname, '../../server/openapi.yaml');
const openApiContent = readFileSync(openApiPath, 'utf-8');
const openApiSpec = yaml.parse(openApiContent);

// Expected schemas based on TypeScript types
const expectedSchemas = {
  // Workspace types
  Workspace: ['id', 'name', 'url_slug', 'short_code', 'description', 'created_at', 'updated_at'],
  WorkspaceLifecycleState: ['id', 'label', 'color', 'sort_order'],
  WorkspaceOwnerOption: ['id', 'name', 'sort_order'],
  WorkspaceMemberInfo: ['workspace', 'user_id', 'role', 'display_name', 'email', 'created_at'],
  WorkspaceUserInfo: ['id', 'user_id', 'email', 'display_name', 'auth_provider', 'is_active'],
  
  // Schema types
  EntitySchema: ['id', 'workspace', 'name', 'fields', 'color', 'icon', 'entity_count', 'created_at', 'updated_at'],
  
  // Entity types
  EntityRecord: ['_uid', '_workspace', '_schemaId', '_name', '_slug', '_namespace', '_description', '_owner', '_lifecycle', '_tags', '_links', '_visibilityMode', 'canView', 'canEdit', 'canDelete', 'canAdmin', 'canCreateChild'],
  EntitySummary: ['_uid', '_workspace', '_schemaId', '_name', '_slug', '_namespace', '_description', '_owner', '_lifecycle', '_tags', '_links', '_visibilityMode', 'canView', 'canEdit', 'canDelete', 'canAdmin', 'canCreateChild'],
  EntityLink: ['url', 'title', 'type'],
  
  // Project types
  Project: ['id', 'workspace', 'name', 'description', 'owner', 'status', 'file_count', 'created_at', 'updated_at', 'canEdit', 'canDelete', 'canManageFiles'],
  ProjectDetail: ['id', 'workspace', 'name', 'description', 'owner', 'status', 'file_count', 'created_at', 'updated_at', 'canEdit', 'canDelete', 'canManageFiles', 'files'],
  ProjectFile: ['id', 'path', 'name', 'size_bytes', 'created_at', 'updated_at'],
  FileTree: ['folders', 'rootFiles'],
  
  // Audit types
  AuditLogEntry: ['id', 'workspace', 'timestamp', 'user_id', 'operation', 'entity_type', 'entity_id', 'entity_name', 'entity_slug', 'schema_id', 'changes', 'metadata'],
};

// Validate that schemas exist in OpenAPI spec
const schemas = openApiSpec.components?.schemas || {};

console.log('🔍 Validating OpenAPI schema against TypeScript types...\n');

for (const [schemaName, expectedFields] of Object.entries(expectedSchemas)) {
  const schema = schemas[schemaName];
  
  if (!schema) {
    addError(`components.schemas.${schemaName}`, `Schema '${schemaName}' is missing from OpenAPI spec`);
    continue;
  }
  
  // Check if it's a reference or allOf
  if (schema.allOf) {
    addError(`components.schemas.${schemaName}`, `Schema uses allOf - manual validation needed`, 'warning');
    continue;
  }
  
  const properties = schema.properties || {};
  
  // Check for missing fields
  for (const field of expectedFields) {
    if (!properties[field]) {
      addError(`components.schemas.${schemaName}.${field}`, `Field '${field}' is missing from OpenAPI schema`);
    }
  }
  
  // Check for extra fields (warning only)
  for (const field of Object.keys(properties)) {
    if (!expectedFields.includes(field)) {
      addError(`components.schemas.${schemaName}.${field}`, `Field '${field}' exists in OpenAPI but not in TypeScript types`, 'warning');
    }
  }
}

// Report results
const errorCount = errors.filter(e => e.severity === 'error').length;
const warningCount = errors.filter(e => e.severity === 'warning').length;

if (errors.length === 0) {
  console.log('✅ All validations passed!\n');
  process.exit(0);
} else {
  console.log('Validation Results:\n');
  
  errors.forEach(({ path, message, severity }) => {
    const icon = severity === 'error' ? '❌' : '⚠️';
    console.log(`${icon} [${severity.toUpperCase()}] ${path}`);
    console.log(`   ${message}\n`);
  });
  
  console.log(`\nSummary: ${errorCount} error(s), ${warningCount} warning(s)\n`);
  
  if (errorCount > 0) {
    console.log('❌ Validation failed. Please update the OpenAPI spec to match TypeScript types.\n');
    process.exit(1);
  } else {
    console.log('⚠️  Validation passed with warnings.\n');
    process.exit(0);
  }
}
