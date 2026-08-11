import { useEffect, useMemo, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type {
  PublicCatalogConfig,
  PublicCatalogEntityOverride,
  PublicCatalogPage,
  PublicCatalogApiArtifact
} from '@arch-register/api-types/publicCatalogContract';
import {
  usePublicCatalogConfig,
  useUpdatePublicCatalogConfig
} from '../../../hooks/usePublicCatalogConfig';
import styles from './LifecycleSubSection.module.css';

const emptyConfig: PublicCatalogConfig = {
  enabled: false,
  title: undefined,
  description: undefined,
  indexable: false,
  schemas: [],
  entityOverrides: [],
  pages: [],
  apiArtifacts: []
};

const pretty = (value: unknown) => JSON.stringify(value ?? [], null, 2);

export const PublicCatalogSubSection = ({
  workspaceSlug,
  schemas
}: {
  workspaceSlug: string;
  schemas: Array<{
    id: string;
    name: string;
    fields: Array<{ id: string; name: string; type: string }>;
  }>;
}) => {
  const { data, isLoading, isError } = usePublicCatalogConfig(workspaceSlug);
  const update = useUpdatePublicCatalogConfig(workspaceSlug);
  const [config, setConfig] = useState<PublicCatalogConfig>(emptyConfig);
  const [overridesJson, setOverridesJson] = useState('[]');
  const [pagesJson, setPagesJson] = useState('[]');
  const [artifactsJson, setArtifactsJson] = useState('[]');
  const [advancedError, setAdvancedError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const next: PublicCatalogConfig = {
      enabled: data.enabled,
      title: data.title,
      description: data.description,
      indexable: data.indexable,
      schemas: data.schemas,
      entityOverrides: data.entityOverrides,
      pages: data.pages,
      apiArtifacts: data.apiArtifacts
    };
    setConfig(next);
    setOverridesJson(pretty(next.entityOverrides));
    setPagesJson(pretty(next.pages));
    setArtifactsJson(pretty(next.apiArtifacts));
  }, [data]);

  const selectedBySchema = useMemo(
    () => new Map(config.schemas.map(item => [item.schemaId, new Set(item.fieldIds)])),
    [config.schemas]
  );

  const toggleSchema = (schemaId: string, checked: boolean) => {
    setConfig(current => ({
      ...current,
      schemas: checked
        ? [...current.schemas, { schemaId, fieldIds: [] }]
        : current.schemas.filter(item => item.schemaId !== schemaId)
    }));
  };

  const toggleField = (schemaId: string, fieldId: string, checked: boolean) => {
    setConfig(current => ({
      ...current,
      schemas: current.schemas.map(item => {
        if (item.schemaId !== schemaId) return item;
        return {
          ...item,
          fieldIds: checked
            ? [...item.fieldIds, fieldId]
            : item.fieldIds.filter(candidate => candidate !== fieldId)
        };
      })
    }));
  };

  const dirty =
    data != null &&
    JSON.stringify({
      ...config,
      entityOverrides: overridesJson,
      pages: pagesJson,
      apiArtifacts: artifactsJson
    }) !==
      JSON.stringify({
        enabled: data.enabled,
        title: data.title,
        description: data.description,
        indexable: data.indexable,
        schemas: data.schemas,
        entityOverrides: pretty(data.entityOverrides),
        pages: pretty(data.pages),
        apiArtifacts: pretty(data.apiArtifacts)
      });

  const save = async () => {
    try {
      const entityOverrides = JSON.parse(overridesJson) as PublicCatalogEntityOverride[];
      const pages = JSON.parse(pagesJson) as PublicCatalogPage[];
      const apiArtifacts = JSON.parse(artifactsJson) as PublicCatalogApiArtifact[];
      setAdvancedError(null);
      await update.mutateAsync({
        ...config,
        title: config.title?.trim() || undefined,
        description: config.description?.trim() || undefined,
        entityOverrides,
        pages,
        apiArtifacts
      });
    } catch (error) {
      setAdvancedError(
        error instanceof Error ? error.message : 'Invalid publication configuration'
      );
    }
  };

  if (isLoading) return <div className={styles.blockList}>Loading public catalog settings…</div>;
  if (isError)
    return <div className={styles.blockList}>Unable to load public catalog settings.</div>;

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <Button
          disabled={!dirty || update.isPending}
          onClick={() => {
            if (data) {
              setConfig({
                enabled: data.enabled,
                title: data.title,
                description: data.description,
                indexable: data.indexable,
                schemas: data.schemas,
                entityOverrides: data.entityOverrides,
                pages: data.pages,
                apiArtifacts: data.apiArtifacts
              });
              setOverridesJson(pretty(data.entityOverrides));
              setPagesJson(pretty(data.pages));
              setArtifactsJson(pretty(data.apiArtifacts));
            }
          }}
        >
          Cancel
        </Button>
        <Button variant="primary" disabled={!dirty || update.isPending} onClick={() => void save()}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Public catalog</div>
          <div className={styles.sectionSub}>
            Publish a separate, read-only catalog for external consumers. Nothing is public until
            you enable it and select the content below.
          </div>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Enable public catalog</div>
              <div className={styles.fieldHint}>Unauthenticated readers use the /public URL.</div>
            </div>
            <div className={styles.fieldRight}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={event =>
                  setConfig(current => ({ ...current, enabled: event.target.checked }))
                }
              />
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Title</div>
            </div>
            <div className={styles.fieldRight}>
              <TextInput
                value={config.title ?? ''}
                onChange={value =>
                  setConfig(current => ({ ...current, title: value ?? undefined }))
                }
                style={{ maxWidth: 540 }}
              />
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Description</div>
            </div>
            <div className={styles.fieldRight}>
              <TextArea
                value={config.description ?? ''}
                onChange={value =>
                  setConfig(current => ({ ...current, description: value ?? undefined }))
                }
                rows={4}
                style={{ maxWidth: 540 }}
              />
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Allow indexing</div>
              <div className={styles.fieldHint}>
                The default is noindex for private deployments.
              </div>
            </div>
            <div className={styles.fieldRight}>
              <input
                type="checkbox"
                checked={config.indexable}
                onChange={event =>
                  setConfig(current => ({ ...current, indexable: event.target.checked }))
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Entity schemas and fields</div>
          <div className={styles.sectionSub}>
            Choose every field that may be returned publicly. The server rejects restricted field
            groups.
          </div>
        </div>
        <div className={styles.sectionBody}>
          {schemas.map(schema => {
            const fields = selectedBySchema.get(schema.id);
            return (
              <div
                key={schema.id}
                style={{ padding: '8px 0', borderBottom: '1px dashed var(--panel-border)' }}
              >
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={fields != null}
                    onChange={event => toggleSchema(schema.id, event.target.checked)}
                  />
                  <strong>{schema.name}</strong>
                </label>
                {fields && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 6,
                      padding: '8px 0 2px 24px'
                    }}
                  >
                    {schema.fields.map(field => (
                      <label
                        key={field.id}
                        style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}
                      >
                        <input
                          type="checkbox"
                          checked={fields.has(field.id)}
                          onChange={event => toggleField(schema.id, field.id, event.target.checked)}
                        />
                        {field.name} <span className="dim">({field.type})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Advanced publication selectors</div>
          <div className={styles.sectionSub}>
            Use JSON arrays for per-entity overrides, workspace/entity wiki pages, and normalized
            API specifications. IDs are available from the normal authenticated catalog URLs/API.
          </div>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Entity overrides</div>
            </div>
            <div className={styles.fieldRight}>
              <TextArea
                value={overridesJson}
                onChange={value => setOverridesJson(value ?? '[]')}
                rows={5}
              />
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Wiki pages</div>
            </div>
            <div className={styles.fieldRight}>
              <TextArea
                value={pagesJson}
                onChange={value => setPagesJson(value ?? '[]')}
                rows={7}
              />
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>API specifications</div>
            </div>
            <div className={styles.fieldRight}>
              <TextArea
                value={artifactsJson}
                onChange={value => setArtifactsJson(value ?? '[]')}
                rows={5}
              />
            </div>
          </div>
          {advancedError && (
            <div style={{ color: 'var(--error-fg, #d55)', fontSize: 12 }}>{advancedError}</div>
          )}
        </div>
      </div>
    </div>
  );
};
