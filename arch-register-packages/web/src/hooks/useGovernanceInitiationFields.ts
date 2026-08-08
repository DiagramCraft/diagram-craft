import { useMemo } from 'react';
import type { GovernanceInitiationField } from '@arch-register/api-types/governanceInitiationFields';
import { useGovernanceWorkflowConfig } from './useGovernanceWorkflowConfig';
import { useEnums } from './useEnums';

export const useGovernanceInitiationFields = (
  workspace: string,
  caseKind: string,
  caseSubkind: string | null
) => {
  const query = useGovernanceWorkflowConfig(workspace);
  const { data: enums = [] } = useEnums(workspace);
  const fields = useMemo<GovernanceInitiationField[]>(() => {
    const kind = query.data?.case_kinds.find(candidate => candidate.case_kind === caseKind);
    if (!kind || kind.supportsInitiationFields === false) return [];
    const row = query.data?.configs.find(
      candidate => candidate.case_kind === caseKind && candidate.case_subkind === caseSubkind
    );
    const workspaceRow = query.data?.configs.find(
      candidate => candidate.case_kind === caseKind && candidate.case_subkind == null
    );
    const resolved =
      row?.config.initiationFields ??
      workspaceRow?.config.initiationFields ??
      kind.defaultConfig.initiationFields ??
      [];
    return resolved.map(field =>
      field.type === 'enum' && !field.options && field.enumId
        ? {
            ...field,
            options: enums.find(enumeration => enumeration.id === field.enumId)?.options ?? []
          }
        : field
    );
  }, [caseKind, caseSubkind, enums, query.data]);
  return { ...query, fields };
};
