import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DataProvider, DataProviderRegistry } from '@diagram-craft/model/dataProvider';
import { useDocument } from '../../../application';
import { UrlDataProvider, UrlDataProviderId } from '@diagram-craft/model/dataProviderUrl';
import {
  DefaultDataProvider,
  DefaultDataProviderId
} from '@diagram-craft/model/dataProviderDefault';
import { Select } from '@diagram-craft/app-components/Select';
import { useState } from 'react';
import { TextInput } from '@diagram-craft/app-components/TextInput';

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

export function DataProviderSettingsDialog(props: { onClose: () => void; open: boolean }) {
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

  return (
    <Dialog
      buttons={[
        {
          type: 'default',
          label: 'Close',
          onClick: e => {
            if (provider === undefined) {
              document.data.provider = provider;
              props.onClose();
            } else {
              e.preventDefault();

              const error = provider.verifySettings();
              error.then(f => {
                if (!f) {
                  document.data.provider = provider;
                  props.onClose();
                } else {
                  setErrorMessage(f);
                }
              });
            }
          }
        }
      ]}
      onClose={props.onClose}
      open={props.open}
      title={'Data Provider Settings'}
    >
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
            }}
          >
            <Select.Item value={'none'}>None</Select.Item>
            <Select.Item value={DefaultDataProviderId}>Document</Select.Item>
            <Select.Item value={UrlDataProviderId}>URL</Select.Item>
          </Select.Root>
        </div>

        {errorMessage && <div style={{ color: 'var(--error-fg)' }}>{errorMessage}</div>}
        {provider instanceof UrlDataProvider && <UrlDataProviderSettings provider={provider} />}
        {provider instanceof DefaultDataProvider && (
          <DefaultDataProviderSettings provider={provider} />
        )}
      </div>
    </Dialog>
  );
}
