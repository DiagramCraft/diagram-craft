import { SaveBarButtons } from '../SaveBarButtons';
import { useEffect, useState } from 'react';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { SupportedCurrency } from '@arch-register/api-types/workspaceConfigContract';
import { useUpdateSupportedCurrencies } from '../../../hooks/useWorkspaceConfig';
import { ListEditor } from '../../../components/ListEditor';
import { SettingsBlock } from '../SettingsBlock';
import { SectionActions } from '../SectionActions';
import styles from './SupportedCurrenciesSubSection.module.css';

export const SupportedCurrenciesSubSection = ({
  workspaceId,
  currencies,
  defaultCurrency
}: {
  workspaceId: string;
  currencies: SupportedCurrency[];
  defaultCurrency: string;
}) => {
  const [items, setItems] = useState<SupportedCurrency[]>(currencies);
  const [defaultCode, setDefaultCode] = useState(defaultCurrency);
  const mutation = useUpdateSupportedCurrencies(workspaceId);

  useEffect(() => {
    setItems(currencies);
    setDefaultCode(defaultCurrency);
  }, [currencies, defaultCurrency]);

  const dirty =
    JSON.stringify(items) !== JSON.stringify(currencies) || defaultCode !== defaultCurrency;

  const update = (index: number, patch: Partial<SupportedCurrency>) => {
    // Keep the default pointing at the same row when its code is edited
    if (patch.code !== undefined && items[index]?.code === defaultCode) {
      setDefaultCode(patch.code);
    }
    setItems(current => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  // Adds and removals come through here; when the default's row is removed, fall back to the first remaining code
  const handleListChange = (next: SupportedCurrency[]) => {
    if (
      next.length < items.length &&
      defaultCode !== '' &&
      !next.some(item => item.code === defaultCode)
    ) {
      setDefaultCode(next.find(item => item.code)?.code ?? '');
    }
    setItems(next);
  };

  const save = async () => {
    await mutation.mutateAsync({
      currencies: items.map((item, index) => ({ ...item, sort_order: index })),
      default_currency: defaultCode
    });
  };

  return (
    <>
      <SectionActions>
        <SaveBarButtons
          dirty={dirty}
          pending={mutation.isPending}
          onCancel={() => {
            setItems(currencies);
            setDefaultCode(defaultCurrency);
          }}
          onSave={save}
        />
      </SectionActions>
      <SettingsBlock
        title="Supported currencies"
        description="Currency fields accept codes in this list. Removing a code does not change existing values. The default currency is used when entering an amount without an explicit currency."
      >
        <ListEditor
          items={items}
          onChange={handleListChange}
          createItem={() => ({ code: '', label: '', sort_order: items.length })}
          addLabel="Add currency"
          renderItem={(currency, { index }) => (
            <div className={styles.currencyRow}>
              <input
                type="radio"
                name="default-currency"
                className={styles.defaultRadio}
                aria-label={`Use ${currency.code || 'this currency'} as default`}
                checked={currency.code !== '' && currency.code === defaultCode}
                disabled={currency.code === ''}
                onChange={() => setDefaultCode(currency.code)}
              />
              <TextInput
                value={currency.code}
                onChange={value => update(index, { code: (value ?? '').toUpperCase() })}
              />
              <TextInput
                value={currency.label}
                onChange={value => update(index, { label: value ?? '' })}
              />
            </div>
          )}
        />
      </SettingsBlock>
    </>
  );
};
