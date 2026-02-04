import { DataProvider, DataProviderRegistry } from '@diagram-craft/model/dataProvider';
import { useApplication, useDocument } from '../../../application';
import {
  UrlDataProvider,
  UrlDataProviderId
} from '@diagram-craft/model/data-providers/dataProviderUrl';
import {
  DefaultDataProvider,
  DefaultDataProviderId
} from '@diagram-craft/model/data-providers/dataProviderDefault';
import {
  RESTDataProvider,
  RestDataProviderId
} from '@diagram-craft/model/data-providers/dataProviderRest';
import { Select } from '@diagram-craft/app-components/Select';
import { useState } from 'react';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPencil, TbPlus, TbTrash, TbRefresh } from 'react-icons/tb';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import styles from './ModelProvidersTab.module.css';
import { Dialog } from '@diagram-craft/app-components/Dialog';

type ProviderSettingsProps<T extends DataProvider> = {
  provider: T;
};

const UrlDataProviderSettings = (props: ProviderSettingsProps<UrlDataProvider>) => {
  const [dataUrl, setDataUrl] = useState<string>(props.provider.dataUrl || '');
  const [schemaUrl, setSchemaUrl] = useState<string>(props.provider.schemaUrl || '');
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

const RESTDataProviderSettings = (props: ProviderSettingsProps<RESTDataProvider>) => {
  const [baseUrl, setBaseUrl] = useState<string>(props.provider.baseUrl || '');
  return (
    <div className={styles.modelProvidersTabStack}>
      <div className={styles.modelProvidersTabSettingsGroup}>
        <label className={styles.modelProvidersTabSettingsLabel}>{'Base URL'}:</label>
        <TextInput
          type="text"
          value={baseUrl}
          onChange={v => {
            setBaseUrl(v ?? '');
            props.provider.baseUrl = v || undefined;
          }}
        />
      </div>
    </div>
  );
};

type ProviderWithId = {
  id: string;
  provider: DataProvider;
  isFirst: boolean;
};

export const ModelProvidersTab = () => {
  const document = useDocument();
  const application = useApplication();

  const [providers, setProviders] = useState<ProviderWithId[]>(() => {
    return document.data.providers.map((p, index) => ({
      id: p.id,
      provider: DataProviderRegistry.get(p.providerId)!(p.serialize()),
      isFirst: index === 0
    }));
  });

  const [editingProvider, setEditingProvider] = useState<{
    open: boolean;
    provider?: ProviderWithId;
    isNew?: boolean;
  }>({ open: false });

  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();

  const saveProviders = async (providersToSave: ProviderWithId[] = providers) => {
    try {
      // Save all providers
      const newProviders = providersToSave.map(p => {
        if (!p.isFirst) p.provider.id = p.id;
        return p.provider;
      });
      document.data.setProviders(newProviders);
      setSuccessMessage('Providers saved successfully');
      setErrorMessage(undefined);
    } catch (_error) {
      setErrorMessage('Failed to save providers');
      setSuccessMessage(undefined);
    }
  };

  const handleAddProvider = () => {
    setEditingProvider({ open: true, isNew: true });
  };

  const handleEditProvider = (providerWithId: ProviderWithId) => {
    setEditingProvider({ open: true, provider: providerWithId });
  };

  const handleDeleteProvider = (providerWithId: ProviderWithId) => {
    application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Delete Provider',
          message: `Are you sure you want to delete provider "${providerWithId.id}"?`,
          okLabel: 'Delete',
          okType: 'danger',
          cancelLabel: 'Cancel'
        },
        async () => {
          const updatedProviders = providers.filter(p => p.id !== providerWithId.id);
          setProviders(updatedProviders);

          // Auto-save after deletion
          try {
            const newProviders = updatedProviders.map(p => {
              if (!p.isFirst) p.provider.id = p.id;
              return p.provider;
            });
            document.data.setProviders(newProviders);
            setSuccessMessage('Provider deleted successfully');
            setErrorMessage(undefined);
          } catch (_error) {
            setErrorMessage('Failed to delete provider');
            setSuccessMessage(undefined);
          }
        }
      )
    );
  };

  const handleSaveEditingProvider = async (newProvider: DataProvider, id: string) => {
    // Verify provider settings before saving
    const error = await newProvider.verifySettings();
    if (error) {
      setErrorMessage(`Error in provider settings: ${error}`);
      setSuccessMessage(undefined);
      return;
    }

    let updatedProviders: ProviderWithId[];
    if (editingProvider.isNew) {
      const newProviderWithId: ProviderWithId = {
        id,
        provider: newProvider,
        isFirst: false
      };
      updatedProviders = [...providers, newProviderWithId];
      setProviders(updatedProviders);
    } else if (editingProvider.provider) {
      updatedProviders = providers.map(p =>
        p.id === editingProvider.provider!.id ? { ...p, provider: newProvider } : p
      );
      setProviders(updatedProviders);
    } else {
      return;
    }
    setEditingProvider({ open: false });

    // Auto-save after add/edit
    await saveProviders(updatedProviders);

    setTimeout(async () => {
      await document.data.db.refreshSchemas();
      await document.data.db.refreshData();
    }, 100);
  };

  const handleRefreshAll = async () => {
    try {
      await document.data.db.refreshSchemas();
      await document.data.db.refreshData();
      setSuccessMessage('All data refreshed successfully');
      setErrorMessage(undefined);
    } catch (_error) {
      setErrorMessage('Failed to refresh data');
      setSuccessMessage(undefined);
    }
  };

  const getProviderTypeName = (providerId: string): string => {
    switch (providerId) {
      case UrlDataProviderId:
        return 'URL';
      case RestDataProviderId:
        return 'REST API';
      case DefaultDataProviderId:
        return 'Document';
      default:
        return providerId;
    }
  };

  const getProviderConfigDisplay = (provider: DataProvider): string => {
    if (provider instanceof UrlDataProvider) {
      return provider.dataUrl || 'No URL configured';
    } else if (provider instanceof RESTDataProvider) {
      return provider.baseUrl || 'No base URL configured';
    } else if (provider instanceof DefaultDataProvider) {
      return 'Built-in document storage';
    }
    return 'No configuration';
  };

  return (
    <>
      <div className={styles.modelProvidersTabStack}>
        <div className={styles.modelProvidersTabHeader}>
          <p className={styles.modelProvidersTabTitle}>Model Providers</p>
          <div className={styles.modelProvidersTabHeaderActions}>
            <Button
              type="secondary"
              onClick={handleRefreshAll}
              style={{ display: 'flex', gap: '0.25rem' }}
            >
              <TbRefresh /> Refresh All
            </Button>
            <Button
              type="secondary"
              onClick={handleAddProvider}
              style={{ display: 'flex', gap: '0.25rem' }}
            >
              <TbPlus /> Add Provider
            </Button>
          </div>
        </div>

        {errorMessage && <div className={styles.modelProvidersTabErrorMessage}>{errorMessage}</div>}
        {successMessage && (
          <div className={styles.modelProvidersTabSuccessMessage}>{successMessage}</div>
        )}

        {providers.length === 0 ? (
          <div className={styles.modelProvidersTabEmptyState}>
            <p>No providers configured</p>
            <Button type="primary" onClick={handleAddProvider}>
              <TbPlus /> Add Your First Provider
            </Button>
          </div>
        ) : (
          <table className={styles.modelProvidersTabTable}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Configuration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(providerWithId => (
                <tr key={providerWithId.id}>
                  <td>{providerWithId.id}</td>
                  <td>{getProviderTypeName(providerWithId.provider.providerId)}</td>
                  <td>{getProviderConfigDisplay(providerWithId.provider)}</td>
                  <td>
                    <div className={styles.modelProvidersTabTableActions}>
                      <Button
                        type="icon-only"
                        onClick={() => handleEditProvider(providerWithId)}
                        title="Edit provider"
                        disabled={providerWithId.isFirst}
                      >
                        <TbPencil />
                      </Button>
                      {!providerWithId.isFirst && (
                        <Button
                          type="icon-only"
                          onClick={() => handleDeleteProvider(providerWithId)}
                          title="Delete provider"
                        >
                          <TbTrash />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingProvider.open && (
        <ProviderEditDialog
          open={editingProvider.open}
          provider={editingProvider.provider?.provider}
          providerId={editingProvider.provider?.id}
          isNew={editingProvider.isNew}
          onSave={handleSaveEditingProvider}
          onCancel={() => setEditingProvider({ open: false })}
        />
      )}
    </>
  );
};

type ProviderEditDialogProps = {
  open: boolean;
  provider?: DataProvider;
  providerId?: string;
  isNew?: boolean;
  onSave: (provider: DataProvider, id: string) => void;
  onCancel: () => void;
};

const ProviderEditDialog = (props: ProviderEditDialogProps) => {
  const document = useDocument();
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    props.provider?.providerId ?? UrlDataProviderId
  );
  const [id, setId] = useState<string>(props.providerId ?? '');
  const [edited, setEdited] = useState<boolean>(false);
  const [provider, setProvider] = useState<DataProvider>(() => {
    if (props.provider) {
      return props.provider;
    }
    return DataProviderRegistry.get(UrlDataProviderId)!('{}');
  });

  const existingProviders = document.data.providers;
  const isIdTaken =
    id.trim() !== '' &&
    existingProviders.some(p => p.id === id.trim() && p.id !== props.providerId);
  const isIdValid = id.trim() !== '' && !isIdTaken;

  const handleProviderTypeChange = (newProviderId: string) => {
    if (newProviderId === DefaultDataProviderId) return; // Don't allow DefaultDataProvider

    setSelectedProviderId(newProviderId);
    const newProvider = DataProviderRegistry.get(newProviderId)!('{}');
    setProvider(newProvider);
  };

  const handleSave = () => {
    if (!isIdValid) return;
    props.onSave(provider, id.trim());
  };

  return (
    <Dialog
      title={props.isNew ? 'Add Provider' : 'Edit Provider'}
      open={props.open}
      onClose={props.onCancel}
      buttons={[
        {
          label: props.isNew ? 'Add' : 'Save',
          type: 'default',
          onClick: handleSave
        },
        {
          label: 'Cancel',
          type: 'cancel',
          onClick: props.onCancel
        }
      ]}
    >
      <div className={styles.modelProvidersTabDialogContent}>
        <div className={styles.modelProvidersTabProviderGroup}>
          <label className={styles.modelProvidersTabProviderLabel}>Provider name:</label>
          <TextInput
            value={id}
            onChange={v => {
              setId(v ?? '');
              setEdited(true);
            }}
            disabled={!props.isNew}
          />
          {isIdTaken && (
            <div className={styles.modelProvidersTabErrorMessage}>This name is already taken</div>
          )}
          {edited && id.trim() === '' && (
            <div className={styles.modelProvidersTabErrorMessage}>Provider name is required</div>
          )}
        </div>

        <div className={styles.modelProvidersTabProviderGroup}>
          <label className={styles.modelProvidersTabProviderLabel}>Provider Type:</label>
          <Select.Root value={selectedProviderId} onChange={v => v && handleProviderTypeChange(v)}>
            <Select.Item value={UrlDataProviderId}>URL</Select.Item>
            <Select.Item value={RestDataProviderId}>REST API</Select.Item>
          </Select.Root>
        </div>

        {provider instanceof UrlDataProvider && <UrlDataProviderSettings provider={provider} />}
        {provider instanceof RESTDataProvider && <RESTDataProviderSettings provider={provider} />}
      </div>
    </Dialog>
  );
};
