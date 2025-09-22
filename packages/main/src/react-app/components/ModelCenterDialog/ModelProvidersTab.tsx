import { DataProvider, DataProviderRegistry } from '@diagram-craft/model/dataProvider';
import { useDocument } from '../../../application';
import { UrlDataProvider, UrlDataProviderId } from '@diagram-craft/model/dataProviderUrl';
import {
  DefaultDataProvider,
  DefaultDataProviderId
} from '@diagram-craft/model/dataProviderDefault';
import { RESTDataProvider, RestDataProviderId } from '@diagram-craft/model/dataProviderRest';
import { Select } from '@diagram-craft/app-components/Select';
import { useState } from 'react';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';

type ProviderSettingsProps<T extends DataProvider> = {
  provider: T;
};

const UrlDataProviderSettings = (props: ProviderSettingsProps<UrlDataProvider>) => {
  const [dataUrl, setDataUrl] = useState<string>(props.provider.dataUrl!);
  const [schemaUrl, setSchemaUrl] = useState<string>(props.provider.schemaUrl!);
  return (
    <div className={'util-vstack'}>
      <div className={'util-vstack'} style={{ gap: '0.2rem' }}>
        <label>{'Data URL'}:</label>
        <TextInput
          type="text"
          value={dataUrl}
          onChange={v => {
            setDataUrl(v ?? '');
            props.provider.dataUrl = v;
          }}
        />
      </div>
      <div className={'util-vstack'} style={{ gap: '0.2rem' }}>
        <label>{'Schema URL'}:</label>
        <TextInput
          value={schemaUrl}
          onChange={v => {
            setSchemaUrl(v ?? '');
            props.provider.schemaUrl = v;
          }}
        />
      </div>
    </div>
  );
};

const DefaultDataProviderSettings = (_props: ProviderSettingsProps<DefaultDataProvider>) => {
  return <div className={'util-vstack'}>No settings needed.</div>;
};

const RESTDataProviderSettings = (props: ProviderSettingsProps<RESTDataProvider>) => {
  const [baseUrl, setBaseUrl] = useState<string>(props.provider.baseUrl || '');
  return (
    <div className={'util-vstack'}>
      <div className={'util-vstack'} style={{ gap: '0.2rem' }}>
        <label>{'Base URL'}:</label>
        <TextInput
          type="text"
          value={baseUrl}
          placeholder="Base URL"
          onChange={v => {
            setBaseUrl(v ?? '');
            props.provider.baseUrl = v || undefined;
          }}
        />
      </div>
    </div>
  );
};

export const ModelProvidersTab = () => {
  const document = useDocument();
  const [provider, setProvider] = useState<DataProvider | undefined>(
    document.data.provider
      ? DataProviderRegistry.get(document.data.provider.id)!(document.data.provider.serialize())
      : undefined
  );
  const [providers, setProviders] = useState<Record<string, DataProvider | undefined>>({
    [provider?.id ?? 'none']: provider
  });
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();

  const handleSave = () => {
    if (provider === undefined) {
      document.data.setProvider(provider);
      setSuccessMessage('Settings saved successfully');
      setErrorMessage(undefined);
    } else {
      const error = provider.verifySettings();
      error.then(f => {
        if (!f) {
          document.data.setProvider(provider);
          setSuccessMessage('Settings saved successfully');
          setErrorMessage(undefined);
        } else {
          setErrorMessage(f);
          setSuccessMessage(undefined);
        }
      });
    }
  };

  return (
    <div className={'util-vstack'} style={{ gap: '1rem' }}>
      <h3>Model Providers</h3>
      <p>Configure and manage your data providers here.</p>

      <div className={'util-vstack'}>
        <div className={'util-vstack'} style={{ gap: '0.2rem' }}>
          <label>Type of provider:</label>

          <Select.Root
            value={provider?.id ?? 'none'}
            onChange={v => {
              let p: DataProvider | undefined;
              if (v === 'none') {
                p = undefined;
              } else if (providers[v!]) {
                p = providers[v!];
              } else {
                p = DataProviderRegistry.get(v!)!('{}');
              }
              setProviders({ ...providers, [v!]: p });
              setProvider(p);
              setErrorMessage(undefined);
              setSuccessMessage(undefined);
            }}
          >
            <Select.Item value={'none'}>None</Select.Item>
            <Select.Item value={DefaultDataProviderId}>Document</Select.Item>
            <Select.Item value={UrlDataProviderId}>URL</Select.Item>
            <Select.Item value={RestDataProviderId}>REST API</Select.Item>
          </Select.Root>
        </div>

        {errorMessage && <div style={{ color: 'var(--error-fg)' }}>{errorMessage}</div>}
        {successMessage && <div style={{ color: 'var(--success-fg)' }}>{successMessage}</div>}

        {provider instanceof UrlDataProvider && <UrlDataProviderSettings provider={provider} />}
        {provider instanceof DefaultDataProvider && (
          <DefaultDataProviderSettings provider={provider} />
        )}
        {provider instanceof RESTDataProvider && <RESTDataProviderSettings provider={provider} />}

        <div style={{ marginTop: '1rem' }}>
          <Button type="primary" onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
};