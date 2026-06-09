// ── Common Types ──────────────────────────────────────────────

export type VisibilityMode = 'public' | 'restricted';

export type ForeignKey<T = string> = {
  id: string;
  name: T;
};

export type EntityLink = {
  url: string;
  title: string;
  type?: string;
};

// ── Capability Types ──────────────────────────────────────────

export type EntityCapabilities = {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canAdmin: boolean;
  canCreateChild: boolean;
};

export type ProjectCapabilities = {
  canEdit: boolean;
  canDelete: boolean;
  canManageFiles: boolean;
};

// ── Error Response ────────────────────────────────────────────

export type ErrorResponse = {
  statusCode: number;
  statusText: string;
  message: string;
  data?: unknown;
};

// ── Success Response ──────────────────────────────────────────

export type SuccessMessage = {
  success: true;
  message: string;
};

export type CountSuccessMessage = SuccessMessage & {
  count: number;
};
