import { useState, useCallback, useEffect } from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import styles from '../WorkspaceSettingsScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { useAiConfig, useUpdateAiConfig } from '../../../hooks/useAiConfig';
import { AiProvider, UpsertAiConfigRequest } from '@arch-register/api-types/aiContract';

export const AiSettingsSubSection = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const { data: config } = useAiConfig(workspaceSlug);
  const updateConfig = useUpdateAiConfig(workspaceSlug);

  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setProvider(config.provider);
      setBaseUrl(config.base_url ?? '');
      setModel(config.model ?? '');
      setTemperature(config.temperature ?? 0.7);
      setSystemPrompt(config.system_prompt ?? '');
      setApiKey('');
    }
  }, [config]);

  const isDirty =
    !config ||
    enabled !== config.enabled ||
    provider !== config.provider ||
    apiKey !== '' ||
    baseUrl !== (config.base_url ?? '') ||
    model !== (config.model ?? '') ||
    temperature !== (config.temperature ?? 0.7) ||
    systemPrompt !== (config.system_prompt ?? '');

  const handleSave = useCallback(async () => {
    const data: UpsertAiConfigRequest = {
      enabled,
      provider,
      base_url: provider === 'openai' ? baseUrl || null : null,
      model: model || null,
      temperature,
      system_prompt: systemPrompt || null
    };
    if (apiKey) {
      data.api_key = apiKey;
    }
    await updateConfig.mutateAsync(data);
    setApiKey('');
  }, [enabled, provider, apiKey, baseUrl, model, temperature, systemPrompt, updateConfig]);

  const handleCancel = () => {
    if (config) {
      setEnabled(config.enabled);
      setProvider(config.provider);
      setBaseUrl(config.base_url ?? '');
      setModel(config.model ?? '');
      setTemperature(config.temperature ?? 0.7);
      setSystemPrompt(config.system_prompt ?? '');
      setApiKey('');
    }
  };

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <Button onClick={handleCancel} disabled={!isDirty}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isDirty || updateConfig.isPending}
        >
          {updateConfig.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>AI Assistant</div>
          <div className={styles.sectionSub}>Configure the AI assistant for this workspace.</div>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Enabled</div>
              <div className={styles.fieldHint}>
                Allow members to use AI features in this workspace.
              </div>
            </div>
            <div className={styles.fieldRight}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <span
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: 36,
                    height: 20,
                    flexShrink: 0
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e => setEnabled(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 999,
                      background: enabled ? 'var(--accent-fg)' : 'var(--cmp-bg)',
                      border: `1px solid ${enabled ? 'var(--accent-fg)' : 'var(--cmp-border)'}`,
                      transition: 'background 0.15s, border-color 0.15s'
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: enabled ? 18 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      transition: 'left 0.15s'
                    }}
                  />
                </span>
                <span style={{ fontSize: 12, color: 'var(--base-fg-dim)' }}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Provider</div>
            </div>
            <div className={styles.fieldRight}>
              <Select.Root
                value={provider}
                onChange={value => setProvider((value as AiProvider | undefined) ?? 'openrouter')}
                style={{ maxWidth: 340 }}
              >
                <Select.Item value="openrouter">OpenRouter</Select.Item>
                <Select.Item value="openai">OpenAI</Select.Item>
              </Select.Root>
            </div>
          </div>

          {provider === 'openai' && (
            <div className={styles.field}>
              <div className={styles.fieldLeft}>
                <div className={styles.fieldLabel}>Base URL</div>
                <div className={styles.fieldHint}>
                  Optional OpenAI-compatible API base URL, e.g. `https://api.openai.com/v1` or your
                  provider endpoint.
                </div>
              </div>
              <div className={styles.fieldRight}>
                <TextInput
                  value={baseUrl}
                  onChange={value => setBaseUrl(value ?? '')}
                  placeholder="https://api.openai.com/v1"
                  style={{ maxWidth: 340 }}
                />
              </div>
            </div>
          )}

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>API Key</div>
              <div className={styles.fieldHint}>
                {config?.has_api_key
                  ? 'A key is configured. Enter a new value to replace it.'
                  : 'Required to use AI features.'}
              </div>
            </div>
            <div className={styles.fieldRight}>
              <TextInput
                type="password"
                value={apiKey}
                onChange={value => setApiKey(value ?? '')}
                placeholder={
                  config?.has_api_key ? '••••••••' : provider === 'openai' ? 'sk-...' : 'sk-or-...'
                }
                autoComplete="off"
                style={{ maxWidth: 340 }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Model</div>
              <div className={styles.fieldHint}>
                {provider === 'openai'
                  ? 'OpenAI or OpenAI-compatible model identifier.'
                  : 'OpenRouter model identifier, e.g. anthropic/claude-sonnet-4-20250514'}
              </div>
            </div>
            <div className={styles.fieldRight}>
              <TextInput
                value={model}
                onChange={value => setModel(value ?? '')}
                placeholder={
                  provider === 'openai' ? 'gpt-4o' : 'anthropic/claude-sonnet-4-20250514'
                }
                style={{ maxWidth: 340 }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Temperature</div>
              <div className={styles.fieldHint}>
                Controls randomness. 0 is deterministic, 1 is most creative.
              </div>
            </div>
            <div className={styles.fieldRight}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 340 }}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={temperature}
                  onChange={e => setTemperature(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    minWidth: 32,
                    textAlign: 'right'
                  }}
                >
                  {temperature.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>System prompt</div>
              <div className={styles.fieldHint}>
                Additional instructions prepended to every conversation. Schema context is always
                included automatically.
              </div>
            </div>
            <div className={styles.fieldRight}>
              <TextArea
                value={systemPrompt}
                onChange={value => setSystemPrompt(value ?? '')}
                placeholder="Optional extra instructions for the AI..."
                rows={4}
                style={{ maxWidth: 500 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
