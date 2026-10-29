import { SaveBarButtons } from '../SaveBarButtons';
import { useState, useCallback, useEffect } from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { SettingsBlock, SettingsBlockField, SettingsBlockList } from '../SettingsBlock';
import { SectionActions } from '../SectionActions';
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
      base_url: provider === 'openai' ? (baseUrl ?? null) : null,
      model: model ?? null,
      temperature,
      system_prompt: systemPrompt ?? null
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
    <>
      <SectionActions>
        <SaveBarButtons
          dirty={isDirty}
          pending={updateConfig.isPending}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      </SectionActions>
      <SettingsBlockList>
        <SettingsBlock
          title="AI Assistant"
          description="Configure the AI assistant for this workspace."
        >
          <SettingsBlockField
            label="Enabled"
            hint="Allow members to use AI features in this workspace."
          >
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
              <span style={{ fontSize: 12, color: 'var(--base-fg-secondary)' }}>
                {enabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </SettingsBlockField>

          <SettingsBlockField label="Provider">
            <Select.Root
              value={provider}
              onChange={value => setProvider((value as AiProvider | undefined) ?? 'openrouter')}
              style={{ maxWidth: 340 }}
            >
              <Select.Item value="openrouter">OpenRouter</Select.Item>
              <Select.Item value="openai">OpenAI</Select.Item>
            </Select.Root>
          </SettingsBlockField>

          {provider === 'openai' && (
            <SettingsBlockField
              label="Base URL"
              hint="Optional OpenAI-compatible API base URL, e.g. `https://api.openai.com/v1` or your provider endpoint."
            >
              <TextInput
                value={baseUrl}
                onChange={value => setBaseUrl(value ?? '')}
                placeholder="https://api.openai.com/v1"
                style={{ maxWidth: 340 }}
              />
            </SettingsBlockField>
          )}

          <SettingsBlockField
            label="API Key"
            hint={
              config?.has_api_key
                ? 'A key is configured. Enter a new value to replace it.'
                : 'Required to use AI features.'
            }
          >
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
          </SettingsBlockField>

          <SettingsBlockField
            label="Model"
            hint={
              provider === 'openai'
                ? 'OpenAI or OpenAI-compatible model identifier.'
                : 'OpenRouter model identifier, e.g. anthropic/claude-sonnet-4-20250514'
            }
          >
            <TextInput
              value={model}
              onChange={value => setModel(value ?? '')}
              placeholder={provider === 'openai' ? 'gpt-4o' : 'anthropic/claude-sonnet-4-20250514'}
              style={{ maxWidth: 340 }}
            />
          </SettingsBlockField>

          <SettingsBlockField
            label="Temperature"
            hint="Controls randomness. 0 is deterministic, 1 is most creative."
          >
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
          </SettingsBlockField>

          <SettingsBlockField
            label="System prompt"
            align="top"
            hint="Additional instructions prepended to every conversation. Schema context is always included automatically."
          >
            <TextArea
              value={systemPrompt}
              onChange={value => setSystemPrompt(value ?? '')}
              placeholder="Optional extra instructions for the AI..."
              rows={4}
              style={{ maxWidth: 500 }}
            />
          </SettingsBlockField>
        </SettingsBlock>
      </SettingsBlockList>
    </>
  );
};
