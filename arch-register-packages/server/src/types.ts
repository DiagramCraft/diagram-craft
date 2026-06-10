import { EntityLink, VisibilityMode } from '@arch-register/api-types/common';

// Wire format used by the DiagramCraft integration (flat strings, not ForeignKey shapes).
export type DiagramCraftEntityResponse = {
  _uid: string;
  _workspace: string;
  _schemaId: string;
  _name: string;
  _slug: string;
  _namespace: string;
  _description: string;
  _owner: string | null;
  _lifecycle: string | null;
  _targetLifecycle: string | null;
  _targetLifecycleDate: string | null;
  _tags: string[];
  _links: EntityLink[];
  _visibilityMode: VisibilityMode | null;
  [field: string]: unknown;
};

export const decodeRefs = (raw: unknown): string[] => {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};

export type AuthProvider = 'local' | 'oidc';

export type JWTPayload = {
  sub: string;
  email?: string;
  name: string;
  provider: AuthProvider;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
};
