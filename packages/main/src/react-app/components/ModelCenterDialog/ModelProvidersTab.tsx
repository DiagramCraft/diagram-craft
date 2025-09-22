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
import styles from './ModelProvidersTab.module.css';

type ProviderSettingsProps<T extends DataProvider> = {
  provider: T;
};

const UrlDataProviderSettings = (props: ProviderSettingsProps<UrlDataProvider>) => {
  const [dataUrl, setDataUrl] = useState<string>(props.provider.dataUrl!);
  const [schemaUrl, setSchemaUrl] = useState<string>(props.provider.schemaUrl!);
  return (
    <div className={styles.modelProvidersTabStack}>
      <div className={styles.modelProvidersTabSettingsGroup}>
        <label className={styles.modelProvidersTabSettingsLabel}>{'Data URL'}:</label>
        <TextInput
          type="text"
          value={dataUrl}
          onChange={v => {
            setDataUrl(v ?? '');
            props.provider.dataUrl = v;
          }}
        />
      </div>
      <div className={styles.modelProvidersTabSettingsGroup}>
        <label className={styles.modelProvidersTabSettingsLabel}>{'Schema URL'}:</label>
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
  return <div className={styles.modelProvidersTabStack}>No settings needed.</div>;
};

const RESTDataProviderSettings = (props: ProviderSettingsProps<RESTDataProvider>) => {
  const [baseUrl, setBaseUrl] = useState<string>(props.provider.baseUrl || '');
  return (
    <div className={styles.modelProvidersTabStack}>
      <div className={styles.modelProvidersTabSettingsGroup}>
        <label className={styles.modelProvidersTabSettingsLabel}>{'Base URL'}:</label>
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
    document.data.providers.length > 0
      ? DataProviderRegistry.get(document.data.providers[0].id)!(
          document.data.providers[0].serialize()
        )
      : undefined
  );
  const [providers, setProviders] = useState<Record<string, DataProvider | undefined>>({
    [provider?.id ?? 'none']: provider
  });
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();

  const handleSave = () => {
    if (provider === undefined) {
      document.data.setProviders([]);
      setSuccessMessage('Settings saved successfully');
      setErrorMessage(undefined);
    } else {
      const error = provider.verifySettings();
      error.then(f => {
        if (!f) {
          document.data.setProviders([provider]);
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
    <>
      <div>Model Providers</div>

      <div className={styles.modelProvidersTabStack}>
        <div className={styles.modelProvidersTabProviderGroup}>
          <label className={styles.modelProvidersTabProviderLabel}>Type of provider:</label>

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

        {errorMessage && <div className={styles.modelProvidersTabErrorMessage}>{errorMessage}</div>}
        {successMessage && (
          <div className={styles.modelProvidersTabSuccessMessage}>{successMessage}</div>
        )}

        {provider instanceof UrlDataProvider && <UrlDataProviderSettings provider={provider} />}
        {provider instanceof DefaultDataProvider && (
          <DefaultDataProviderSettings provider={provider} />
        )}
        {provider instanceof RESTDataProvider && <RESTDataProviderSettings provider={provider} />}

        <div className={styles.modelProvidersTabSaveSection}>
          <Button type="primary" onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </div>
    </>
  );
};
