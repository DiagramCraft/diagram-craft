// ── Common Types ──────────────────────────────────────────────

export type VisibilityMode = 'public' | 'restricted';

export type LifecycleStatus = string;

export type EntityLink = {
  url: string;
  title: string;
  type?: string;
};

// ── Capability Types ──────────────────────────────────────────

// Generic capability type for reusable permission patterns
export type Capabilities<T extends string = string> = Record<`can${Capitalize<T>}`, boolean>;

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
