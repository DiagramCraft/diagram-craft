import type { BrowserView, FilterCondition } from '@arch-register/api-types/viewContract';
import type { BrowserViewConfigMap } from '../../../../entities/components/entityBrowserState';
import {
  parseViewConfigs,
  serializeViewConfigs
} from '../../../../entities/components/entityBrowserState';

export type EntityBrowserEmbedConfig = {
  q: string;
  conditions: FilterCondition[];
  sort: string;
  view: BrowserView;
  viewConfigs: BrowserViewConfigMap;
  projectScope?: 'project' | 'all';
};

const toBase64Url = (input: string): string => {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (input: string): string => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const encodeEntityBrowserEmbedConfig = (config: EntityBrowserEmbedConfig): string => {
  const payload = {
    q: config.q,
    conditions: config.conditions,
    sort: config.sort,
    view: config.view,
    viewConfigs: serializeViewConfigs(config.viewConfigs),
    projectScope: config.projectScope
  };
  return toBase64Url(JSON.stringify(payload));
};

export const decodeEntityBrowserEmbedConfig = (
  raw: string | undefined
): EntityBrowserEmbedConfig | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as Record<string, unknown>;
    if (parsed == null || typeof parsed !== 'object') return null;
    return {
      q: typeof parsed.q === 'string' ? parsed.q : '',
      conditions: Array.isArray(parsed.conditions) ? (parsed.conditions as FilterCondition[]) : [],
      sort: typeof parsed.sort === 'string' ? parsed.sort : 'name',
      view: (typeof parsed.view === 'string' ? parsed.view : 'table') as BrowserView,
      viewConfigs: parseViewConfigs(
        typeof parsed.viewConfigs === 'string' ? parsed.viewConfigs : undefined
      ),
      projectScope:
        parsed.projectScope === 'project' || parsed.projectScope === 'all'
          ? parsed.projectScope
          : undefined
    };
  } catch {
    return null;
  }
};
