const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Date-only strings (YYYY-MM-DD) are parsed as local midnight to avoid a
// UTC-midnight timezone shift landing on the wrong calendar day.
const toDate = (value: unknown): Date | null => {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value);
  const date = DATE_ONLY_RE.test(str) ? new Date(`${str}T00:00:00`) : new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const WORKSPACE_DATE_FORMATS = [
  'iso',
  'month-name',
  'md-slash',
  'dmy-slash',
  'dmy-dot'
] as const;
export type WorkspaceDateFormat = (typeof WORKSPACE_DATE_FORMATS)[number];

export const WORKSPACE_TIME_FORMATS = ['12h', '24h'] as const;
export type WorkspaceTimeFormat = (typeof WORKSPACE_TIME_FORMATS)[number];

export type DateTimeFormatPreference = {
  date_format: WorkspaceDateFormat;
  time_format: WorkspaceTimeFormat;
};

export const DEFAULT_DATE_TIME_FORMAT_PREFERENCE: DateTimeFormatPreference = {
  date_format: 'iso',
  time_format: '24h'
};

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

const isValidPreference = (pref: DateTimeFormatPreference): boolean =>
  (WORKSPACE_DATE_FORMATS as readonly string[]).includes(pref.date_format) &&
  (WORKSPACE_TIME_FORMATS as readonly string[]).includes(pref.time_format);

const resolveDatePreset = (pref: DateTimeFormatPreference): WorkspaceDateFormat =>
  isValidPreference(pref) ? pref.date_format : DEFAULT_DATE_TIME_FORMAT_PREFERENCE.date_format;

const resolveTimePreset = (pref: DateTimeFormatPreference): WorkspaceTimeFormat =>
  isValidPreference(pref) ? pref.time_format : DEFAULT_DATE_TIME_FORMAT_PREFERENCE.time_format;

// Presets are formatted manually (rather than via a locale-driven
// Intl.DateTimeFormat) so output is deterministic regardless of the
// viewer's/test environment's default locale.
const formatDatePart = (date: Date, preset: WorkspaceDateFormat): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  switch (preset) {
    case 'iso':
      return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
    case 'month-name':
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    case 'md-slash':
      return `${pad(month)}/${pad(day)}/${pad(year, 4)}`;
    case 'dmy-slash':
      return `${pad(day)}/${pad(month)}/${pad(year, 4)}`;
    case 'dmy-dot':
      return `${pad(day)}.${pad(month)}.${pad(year, 4)}`;
  }
};

const formatTimePart = (date: Date, preset: WorkspaceTimeFormat): string => {
  const hours = date.getHours();
  const minutes = pad(date.getMinutes());
  if (preset === '24h') return `${pad(hours)}:${minutes}`;
  const period = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${period}`;
};

export const formatDate = (
  value: unknown,
  fallback = '—',
  pref: DateTimeFormatPreference = DEFAULT_DATE_TIME_FORMAT_PREFERENCE
): string => {
  const date = toDate(value);
  return date ? formatDatePart(date, resolveDatePreset(pref)) : fallback;
};

export const formatIsoDate = (value: unknown, fallback = '—'): string => {
  const date = toDate(value);
  if (!date) return fallback;
  return formatDatePart(date, 'iso');
};

export const formatDateTime = (
  value: unknown,
  fallback = '—',
  pref: DateTimeFormatPreference = DEFAULT_DATE_TIME_FORMAT_PREFERENCE
): string => {
  const date = toDate(value);
  if (!date) return fallback;
  return `${formatDatePart(date, resolveDatePreset(pref))}, ${formatTimePart(date, resolveTimePreset(pref))}`;
};

// For call sites (e.g. calendar/timeline headers) that build their own
// Intl.DateTimeFormat rather than formatting a single value.
export const getDateFormatOptions = (
  pref: DateTimeFormatPreference = DEFAULT_DATE_TIME_FORMAT_PREFERENCE
): { locale: string; options: Intl.DateTimeFormatOptions } => ({
  locale: 'en-US',
  options: resolveTimePreset(pref) === '24h' ? { hour12: false } : { hour12: true }
});

export const formatRelativeTime = (
  value: unknown,
  fallback = '—',
  pref: DateTimeFormatPreference = DEFAULT_DATE_TIME_FORMAT_PREFERENCE
): string => {
  const date = toDate(value);
  if (!date) return fallback;
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDatePart(date, resolveDatePreset(pref));
};
