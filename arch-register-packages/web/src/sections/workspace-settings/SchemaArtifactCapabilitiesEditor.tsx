import { Button } from '@diagram-craft/app-components/Button';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TbTrash } from 'react-icons/tb';
import {
  artifactCapabilityDefinitions,
  type ArtifactCapabilityDefinition
} from '@arch-register/api-types/artifactContract';
import type { ArtifactCapability, SchemaField } from '@arch-register/api-types/schemaContract';
import styles from './SchemaSettingsScreen.module.css';

const getDefinition = (type: string): ArtifactCapabilityDefinition | undefined =>
  artifactCapabilityDefinitions.find(definition => definition.type === type);

const getMissingRequiredFields = (
  definition: ArtifactCapabilityDefinition,
  fields: SchemaField[]
) => {
  const fieldIds = new Set(fields.map(field => field.id));
  return definition.requiredFields.filter(fieldId => !fieldIds.has(fieldId));
};

const isEnabledElsewhere = (
  capabilities: ArtifactCapability[],
  currentIndex: number,
  type: string
) => capabilities.some((capability, index) => index !== currentIndex && capability.type === type);

export const getAvailableArtifactCapabilityDefinitions = (capabilities: ArtifactCapability[]) =>
  artifactCapabilityDefinitions.filter(
    definition => !capabilities.some(capability => capability.type === definition.type)
  );

export const SchemaArtifactCapabilitiesEditor = ({
  capabilities,
  fields,
  canEdit,
  onAdd,
  onUpdate,
  onDelete
}: {
  capabilities: ArtifactCapability[];
  fields: SchemaField[];
  canEdit: boolean;
  onAdd: (type: string) => void;
  onUpdate: (index: number, patch: Partial<ArtifactCapability>) => void;
  onDelete: (index: number) => void;
}) => {
  const availableDefinitions = getAvailableArtifactCapabilityDefinitions(capabilities);

  return (
    <>
      <div className={styles.fieldsHead}>
        <div>
          <div className={styles.sectionLabel}>Artifact integrations</div>
        </div>
        {canEdit && (
          <Select.Root
            value={undefined}
            disabled={availableDefinitions.length === 0}
            placeholder={availableDefinitions.length === 0 ? 'All enabled' : 'Add integration...'}
            onChange={value => {
              if (value) onAdd(value);
            }}
            style={{ minWidth: 170, maxWidth: '50%', marginLeft: 'auto' }}
          >
            {availableDefinitions.map(definition => (
              <Select.Item key={definition.type} value={definition.type}>
                {definition.label}
              </Select.Item>
            ))}
          </Select.Root>
        )}
      </div>
      {capabilities.length === 0 ? (
        <div className={styles.fieldsEmpty}>No artifact integrations enabled for this schema.</div>
      ) : (
        <div className={styles.capabilityList}>
          {capabilities.map((capability, index) => {
            const definition = getDefinition(capability.type);
            const missingRequiredFields = definition
              ? getMissingRequiredFields(definition, fields)
              : [];

            return (
              <div className={styles.capabilityCard} key={`${capability.type}-${index}`}>
                <div className={styles.capabilityHeader}>
                  <div className={styles.capabilityIntegration}>
                    <FormElement label="Integration">
                      <Select.Root
                        value={capability.type}
                        disabled={!canEdit}
                        placeholder="Select integration..."
                        onChange={value => {
                          if (value) onUpdate(index, { type: value });
                        }}
                      >
                        {artifactCapabilityDefinitions.map(candidate => (
                          <Select.Item
                            key={candidate.type}
                            value={candidate.type}
                            disabled={isEnabledElsewhere(capabilities, index, candidate.type)}
                          >
                            {candidate.label}
                          </Select.Item>
                        ))}
                        {!definition && (
                          <Select.Item value={capability.type}>
                            Unavailable: {capability.type}
                          </Select.Item>
                        )}
                      </Select.Root>
                    </FormElement>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        icon={<TbTrash size={12} />}
                        onClick={() => onDelete(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                {definition ? (
                  <>
                    <div className={styles.capabilityDescription}>{definition.description}</div>
                    <div className={styles.capabilityMetadata}>
                      <div>
                        <div className={styles.capabilitySubheading}>Provided features</div>
                        <div className={styles.capabilityTags}>
                          {definition.features.map(feature => (
                            <span className={styles.capabilityTag} key={feature}>
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className={styles.capabilitySubheading}>Required schema fields</div>
                        <div className={styles.capabilityFieldList}>
                          {definition.requiredFields.map(fieldId => {
                            const field = fields.find(candidate => candidate.id === fieldId);
                            return (
                              <div className={styles.capabilityFieldOption} key={fieldId}>
                                <span>
                                  {field?.name ?? 'Missing field'} <code>{fieldId}</code>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {missingRequiredFields.length > 0 && (
                      <div className={styles.capabilityUnknownFields}>
                        Schema fields required by this integration are missing:{' '}
                        {missingRequiredFields.join(', ')}
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.capabilityUnknownFields}>
                    This integration is no longer available. Remove it or choose another
                    integration.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
