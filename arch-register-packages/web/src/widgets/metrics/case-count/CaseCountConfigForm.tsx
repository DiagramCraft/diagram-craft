import { Select } from "@diagram-craft/app-components/Select";
import { useWorkspaceContext } from "../../../layouts/WorkspaceContext";
import { DialogSection } from "../../../sections/markdown/editor/BlockDialog";
import { humanizeCaseKind } from "../../../utils/governanceCaseLabels";
import { KNOWN_CASE_KINDS } from "../../data-views/needs-attention/NeedsAttentionConfigForm";
import type { NeedsAttentionScope } from "../../data-views/needs-attention/needsAttentionQueue";
import formStyles from "../../../sections/dashboard/WidgetConfigDialog.module.css";
import { CASE_COUNT_TONES, CaseCountWidgetConfig } from "./types";

const SCOPE_LABEL: Record<NeedsAttentionScope, string> = {
  workspace: "Workspace-wide",
  mine: "Assigned to me",
  late: "Past due",
};

const TONE_LABEL: Record<(typeof CASE_COUNT_TONES)[number], string> = {
  none: "None",
  warning: "Warning",
  danger: "Danger",
};

export const CaseCountConfigForm = ({
  config,
  onChange,
}: {
  config: CaseCountWidgetConfig;
  onChange: (config: CaseCountWidgetConfig) => void;
}) => {
  const { schemas } = useWorkspaceContext();
  const toggleKind = (kind: string, checked: boolean) =>
    onChange({
      ...config,
      caseKinds: checked
        ? [...config.caseKinds, kind]
        : config.caseKinds.filter((existing) => existing !== kind),
    });

  return (
    <>
      <DialogSection label="Entity type">
        <Select.Root
          value={config.schema}
          onChange={(value) => onChange({ ...config, schema: value ?? "" })}
        >
          <Select.Item value="">Choose an entity type…</Select.Item>
          {schemas.map((schema) => (
            <Select.Item key={schema.id} value={schema.id}>
              {schema.name}
            </Select.Item>
          ))}
        </Select.Root>
      </DialogSection>
      <DialogSection label="Case kinds">
        <div className={formStyles.options}>
          {KNOWN_CASE_KINDS.map((kind) => (
            <label key={kind} className={formStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={config.caseKinds.includes(kind)}
                onChange={(event) =>
                  toggleKind(kind, event.currentTarget.checked)
                }
              />
              <span className={formStyles.optionLabel}>
                {humanizeCaseKind(kind)}
              </span>
            </label>
          ))}
        </div>
      </DialogSection>
      <DialogSection label="Scope" required={false}>
        <Select.Root
          value={config.scope}
          onChange={(value) =>
            onChange({
              ...config,
              scope: (value as NeedsAttentionScope) ?? "workspace",
            })
          }
        >
          {(Object.keys(SCOPE_LABEL) as NeedsAttentionScope[]).map((scope) => (
            <Select.Item key={scope} value={scope}>
              {SCOPE_LABEL[scope]}
            </Select.Item>
          ))}
        </Select.Root>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={formStyles.options}>
          <label className={formStyles.optionRow}>
            <span className={formStyles.optionLabel}>
              Colour when above zero
            </span>
            <div className={formStyles.optionControl}>
              <select
                className={formStyles.labelInput}
                value={config.tone}
                onChange={(event) =>
                  onChange({
                    ...config,
                    tone: event.currentTarget
                      .value as CaseCountWidgetConfig["tone"],
                  })
                }
              >
                {CASE_COUNT_TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {TONE_LABEL[tone]}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className={formStyles.optionRow}>
            <span className={formStyles.optionLabel}>
              Subtext ({"{count}"}, {"{due}"})
            </span>
            <div className={formStyles.optionControl}>
              <input
                type="text"
                className={formStyles.labelInput}
                value={config.subtextTemplate}
                onChange={(event) =>
                  onChange({
                    ...config,
                    subtextTemplate: event.currentTarget.value,
                  })
                }
              />
            </div>
          </label>
          <label className={formStyles.optionRow}>
            <span className={formStyles.optionLabel}>Due within (days)</span>
            <div className={formStyles.optionControl}>
              <input
                type="number"
                min={1}
                className={formStyles.labelInput}
                value={config.dueWithinDays}
                onChange={(event) =>
                  onChange({
                    ...config,
                    dueWithinDays: Math.max(
                      1,
                      Number(event.currentTarget.value) || 7,
                    ),
                  })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
