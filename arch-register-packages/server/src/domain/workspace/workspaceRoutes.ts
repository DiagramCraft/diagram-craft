import { AR_COLOR_BLUE, AR_COLOR_GREEN, AR_COLOR_YELLOW } from '@arch-register/api-types/colors';
import { randomUUID } from 'node:crypto';
import { slugify } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import { WorkspaceDbResult } from './db/workspaceDatabase';

export const shortCode = (name: string): string =>
  name
    .split(/\s+/)
    .map(w => (w[0] ?? '').toUpperCase())
    .join('')
    .slice(0, 2);

export const buildDefaultLifecycleStates = (workspace: string, createdAt: Date) => [
  {
    id: randomUUID(),
    workspace,
    label: 'Proposed',
    color: AR_COLOR_BLUE,
    sort_order: 0,
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    label: 'Experimental',
    color: AR_COLOR_BLUE,
    sort_order: 1,
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    label: 'Production',
    color: AR_COLOR_GREEN,
    sort_order: 2,
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    label: 'Deprecated',
    color: AR_COLOR_YELLOW,
    sort_order: 3,
    created_at: createdAt
  }
];

export const buildDefaultWorkspaceTeams = (workspace: string, createdAt: Date) => [
  {
    id: randomUUID(),
    workspace,
    name: 'Platform Team',
    sort_order: 0,
    color: null,
    description: '',
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    name: 'UX Team',
    sort_order: 1,
    color: null,
    description: '',
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    name: 'Security Team',
    sort_order: 2,
    color: null,
    description: '',
    created_at: createdAt
  }
];

export const buildWorkspaceCreateInput = (body: Record<string, unknown>, createdAt: Date) => {
  const { name, description = '', color = '', slug: slugOverride, badge } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });
  const rawSlug = typeof slugOverride === 'string' && slugOverride ? slugOverride : name;
  const urlSlug = slugify(rawSlug);
  httpAssert.string(urlSlug, { message: 'name must contain at least one alphanumeric character' });

  return {
    id: randomUUID(),
    name,
    url_slug: urlSlug,
    short_code:
      typeof badge === 'string' && badge ? badge.slice(0, 2).toUpperCase() : shortCode(name),
    color: typeof color === 'string' ? color : '',
    description: typeof description === 'string' ? description : '',
    created_at: createdAt,
    updated_at: createdAt
  };
};

export const buildWorkspaceUpdateInput = (
  body: Record<string, unknown>,
  current: WorkspaceDbResult,
  updatedAt: Date
) => {
  const { name, description, url_slug, short_code: sc, color } = body;
  httpAssert.string(name, { status: 400, message: 'name is required and must be a string' });
  if (url_slug != null && typeof url_slug === 'string') {
    const cleaned = slugify(url_slug);
    httpAssert.string(cleaned, {
      message: 'url_slug must contain at least one alphanumeric character'
    });
  }

  return {
    name,
    url_slug: typeof url_slug === 'string' ? slugify(url_slug) : current.url_slug,
    short_code: typeof sc === 'string' ? sc : current.short_code,
    color: typeof color === 'string' ? color : current.color,
    description: typeof description === 'string' ? description : current.description,
    updated_at: updatedAt
  };
};

export const normalizeReplicationInclude = (include: unknown) =>
  new Set<string>(
    Array.isArray(include)
      ? (include as unknown[]).filter((x): x is string => typeof x === 'string')
      : ['schemas', 'settings']
  );

