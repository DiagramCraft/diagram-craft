import { SaveBarButtons } from '../SaveBarButtons';
import { Fragment, useEffect, useState } from 'react';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { SupportedCurrency } from '@arch-register/api-types/workspaceConfigContract';
import { useUpdateSupportedCurrencies } from '../../../hooks/useWorkspaceConfig';
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

  const remove = (index: number) => {
    if (items[index]?.code === defaultCode) {
      setDefaultCode(items.find((item, i) => i !== index && item.code)?.code ?? '');
    }
    setItems(current => current.filter((_, i) => i !== index));
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
        <div className={styles.fieldGrid}>
          {items.map((currency, index) => (
            <Fragment key={index}>
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
              <Button
                onClick={() => remove(index)}
                variant={'danger'}
                style={{ marginLeft: '1rem' }}
              >
                <TbTrash size={12} />
              </Button>

              {index < items.length - 1 && (
                <div
                  style={{
                    gridColumn: '1 / 5',
                    borderBottom: '1px dashed var(--panel-border)',
                    marginBottom: '4px'
                  }}
                />
              )}
            </Fragment>
          ))}
        </div>
        <Button
          icon={<TbPlus size={12} />}
          onClick={() =>
            setItems(current => [...current, { code: '', label: '', sort_order: current.length }])
          }
        >
          Add currency
        </Button>
      </SettingsBlock>
    </>
  );
};
