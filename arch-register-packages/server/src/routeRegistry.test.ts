import { defineHandler, H3 } from 'h3';
import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from './db/database';
import type { StorageAdapter } from './storage/storage';
import { API_PREFIXES } from './constants';
import type { GovernanceRegistry } from './domain/governance/governanceRegistry';
import {
  createRouteRegistry,
  routeDescriptors,
  sortRouteDescriptors,
  validateRouteDescriptors,
  type RouteDescriptor
} from './routeRegistry';

const expectedRouteIds = [
  'public-auth',
  'public-catalog',
  'dev',
  'oidc-callback',
  'protected-auth',
  'workspace-management',
  'workspace-enums',
  'workspace-field-groups',
  'workspace-categories',
  'workspace-schemas',
  'workspace-relation-schemas',
  'workspace-relations',
  'integration-relations',
  'integration-governance',
  'workspace-entities',
  'workspace-glossary',
  'entity-sync',
  'api-specification-sync',
  'relation-sync',
  'entity-versions',
  'relation-versions',
  'entity-changes',
  'relation-changes',
  'entity-deprecation',
  'artifacts',
  'baselines',
  'workspace-templates',
  'workspace-views',
  'workspace-dashboards',
  'personal-dashboards',
  'project-dashboards',
  'workspace-collections',
  'workspace-config',
  'public-catalog-config',
  'workspace-analytics',
  'workspace-metrics',
  'jobs',
  'conformance',
  'external-content',
  'webhooks',
  'automation-rules',
  'documents',
  'file-transfer',
  'projects',
  'assessments',
  'assessment-responses',
  'milestones',
  'change-cases',
  'audit',
  'watch',
  'notification-preferences',
  'discussions',
  'governance',
  'governance-workflow-config',
  'wiki-comments',
  'search',
  'ai',
  'diagram-craft'
] as const;

const testDependencies = {
  db: {} as DatabaseAdapter,
  storage: {} as StorageAdapter,
  governanceRegistry: new Map() as GovernanceRegistry
};

const makeTestDescriptor = (
  id: string,
  auth: RouteDescriptor['auth'],
  precedence: number,
  onCreate?: () => void
): RouteDescriptor => ({
  id,
  auth,
  kind: 'orpc',
  dependencies: ['db'],
  prefix: API_PREFIXES.root,
  surfaces: [API_PREFIXES.root],
  precedence,
  create: () => {
    onCreate?.();
    return defineHandler(() => undefined);
  }
});

describe('route registry', () => {
  it('lists every application endpoint exactly once', () => {
    expect(routeDescriptors.map(descriptor => descriptor.id)).toEqual(expectedRouteIds);
    expect(new Set(routeDescriptors.map(descriptor => descriptor.id)).size).toBe(
      expectedRouteIds.length
    );
  });

  it('preserves public/protected ordering and special route classification', () => {
    expect(
      sortRouteDescriptors(routeDescriptors, 'public').map(descriptor => descriptor.id)
    ).toEqual(expectedRouteIds.slice(0, 4));
    expect(
      sortRouteDescriptors(routeDescriptors, 'protected').map(descriptor => descriptor.id)
    ).toEqual(expectedRouteIds.slice(4));

    expect(
      routeDescriptors.find(descriptor => descriptor.id === 'workspace-management')
    ).toMatchObject({
      kind: 'orpc',
      prefix: API_PREFIXES.application
    });
    expect(
      routeDescriptors.find(descriptor => descriptor.id === 'workspace-schemas')
    ).toMatchObject({
      prefix: API_PREFIXES.root,
      surfaces: [API_PREFIXES.application, API_PREFIXES.integrations]
    });
    expect(routeDescriptors.find(descriptor => descriptor.id === 'file-transfer')).toMatchObject({
      kind: 'explicit',
      prefix: API_PREFIXES.application
    });
    expect(routeDescriptors.find(descriptor => descriptor.id === 'ai')).toMatchObject({
      kind: 'explicit',
      prefix: API_PREFIXES.application
    });
    expect(routeDescriptors.find(descriptor => descriptor.id === 'diagram-craft')).toMatchObject({
      kind: 'explicit',
      surfaces: [API_PREFIXES.diagramCraft]
    });

    const protectedRoutes = sortRouteDescriptors(routeDescriptors, 'protected');
    const positionOf = (id: string) => protectedRoutes.findIndex(route => route.id === id);
    expect(positionOf('workspace-management')).toBeLessThan(positionOf('workspace-schemas'));
    expect(positionOf('file-transfer')).toBeLessThan(positionOf('projects'));
    expect(positionOf('search')).toBeLessThan(positionOf('ai'));
    expect(positionOf('ai')).toBeLessThan(positionOf('diagram-craft'));
  });

  it('rejects duplicate IDs and precedence slots', () => {
    const duplicateId = [
      makeTestDescriptor('duplicate', 'public', 0),
      makeTestDescriptor('duplicate', 'public', 1)
    ];
    expect(() => validateRouteDescriptors(duplicateId)).toThrow(
      'Duplicate route descriptor id: duplicate'
    );

    const duplicatePrecedence = [
      makeTestDescriptor('first', 'protected', 10),
      makeTestDescriptor('second', 'protected', 10)
    ];
    expect(() => validateRouteDescriptors(duplicatePrecedence)).toThrow(
      'Duplicate route descriptor precedence for protected: 10'
    );
  });

  it('mounts each auth phase once and reports duplicate mounts', () => {
    const created: string[] = [];
    const descriptors = [
      makeTestDescriptor('public', 'public', 0, () => created.push('public')),
      makeTestDescriptor('protected', 'protected', 100, () => created.push('protected'))
    ];
    const registry = createRouteRegistry(testDependencies, descriptors);
    const app = new H3();

    registry.mount(app, 'public');
    expect(created).toEqual(['public']);
    expect(() => registry.mount(app, 'public')).toThrow('Route descriptor already mounted: public');

    registry.mount(app, 'protected');
    registry.assertComplete();
    expect(created).toEqual(['public', 'protected']);
    registry.dispose();
  });
});
