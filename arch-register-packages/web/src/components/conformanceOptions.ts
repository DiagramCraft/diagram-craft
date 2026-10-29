import type {
  ConformanceCheckStatus,
  ConformanceSeverity
} from '@arch-register/api-types/conformanceContract';

export const CONFORMANCE_STATUS_OPTIONS: Array<{
  value: '' | ConformanceCheckStatus;
  label: string;
}> = [
  { value: '', label: 'Current and historical' },
  { value: 'active', label: 'Active' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'exempt', label: 'Exempt' },
  { value: 'resolved', label: 'Resolved' }
];

export const CONFORMANCE_SEVERITY_OPTIONS: Array<{
  value: '' | ConformanceSeverity;
  label: string;
}> = [
  { value: '', label: 'All severities' },
  { value: 'error', label: 'Errors' },
  { value: 'warning', label: 'Warnings' }
];
