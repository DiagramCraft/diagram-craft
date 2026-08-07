import { useEffect, useState } from 'react';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { SupportedCurrency } from '@arch-register/api-types/workspaceConfigContract';
import { useUpdateSupportedCurrencies } from '../../../hooks/useWorkspaceConfig';
import styles from './LifecycleSubSection.module.css';

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

  const update = (index: number, patch: Partial<SupportedCurrency>) =>
    setItems(current => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const save = async () => {
    await mutation.mutateAsync({
      currencies: items.map((item, index) => ({ ...item, sort_order: index })),
      default_currency: defaultCode
    });
  };

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <Button
          disabled={!dirty || mutation.isPending}
          onClick={() => {
            setItems(currencies);
            setDefaultCode(defaultCurrency);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!dirty || mutation.isPending}
          onClick={() => void save()}
        >
          {mutation.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Supported currencies</div>
          <div className={styles.sectionSub}>
            Currency fields accept codes in this list. Removing a code does not change existing
            values.
          </div>
        </div>
        <div className={styles.sectionBody}>
          {items.map((currency, index) => (
            <div
              key={`${currency.code}-${index}`}
              className={styles.field}
              style={{ gridTemplateColumns: '120px 1fr auto' }}
            >
              <TextInput
                value={currency.code}
                onChange={value => update(index, { code: (value ?? '').toUpperCase() })}
              />
              <TextInput
                value={currency.label}
                onChange={value => update(index, { label: value ?? '' })}
              />
              <Button
                onClick={() => setItems(current => current.filter((_, i) => i !== index))}
                style={{ padding: '0 6px' }}
              >
                <TbTrash size={12} />
              </Button>
            </div>
          ))}
          <Button
            icon={<TbPlus size={12} />}
            onClick={() =>
              setItems(current => [...current, { code: '', label: '', sort_order: current.length }])
            }
          >
            Add currency
          </Button>
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Default currency</div>
          <div className={styles.sectionSub}>
            Used when entering an amount without an explicit currency.
          </div>
        </div>
        <div className={styles.sectionBody}>
          <Select.Root value={defaultCode} onChange={value => setDefaultCode(value ?? '')}>
            {items
              .filter(item => item.code)
              .map(currency => (
                <Select.Item key={currency.code} value={currency.code}>
                  {currency.code} — {currency.label}
                </Select.Item>
              ))}
          </Select.Root>
        </div>
      </div>
    </div>
  );
};
