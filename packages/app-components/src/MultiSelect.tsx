import React, { ChangeEvent, useState } from 'react';
import { Combobox as BaseUICombobox } from '@base-ui/react/combobox';
import { PropsUtils } from '@diagram-craft/utils/propsUtils';
import { extractDataAttributes } from './utils';
import styles from './MultiSelect.module.css';
import { TbX } from 'react-icons/tb';
import { usePortal } from './PortalContext';

export type MultiSelectItem = {
  value: string;
  label: string;
};

export const MultiSelect = (props: Props) => {
  const portal = usePortal();
  const [inputValue, setInputValue] = useState('');

  // Filter available items based on input and exclude already selected items
  const filteredItems = props.availableItems
    .filter(
      item =>
        item.label.toLowerCase().includes(inputValue.toLowerCase()) &&
        !props.selectedValues.includes(item.value)
    )
    .slice(0, props.maxSuggestions ?? 10);

  const addItem = (value: string) => {
    if (value.trim() && !props.selectedValues.includes(value.trim())) {
      props.onSelectionChange([...props.selectedValues, value.trim()]);
      setInputValue('');
    }
  };

  const handleInputValueChange = (value: string, eventDetails: { event?: Event }) => {
    if (props.isIndeterminate) return;
    setInputValue(value);
    if (eventDetails?.event && props.onInputChange) {
      props.onInputChange(value, eventDetails.event as unknown as ChangeEvent<HTMLInputElement>);
    }
  };

  const handleValueChange = (newValues: string[] | null) => {
    if (props.isIndeterminate) return;
    props.onSelectionChange(newValues ?? []);
    setInputValue('');
  };

  // Handle Enter key for custom values
  const handleInputKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (props.isIndeterminate) return;

    if (ev.key === 'Enter') {
      // Check if there's a highlighted item in the list
      const hasHighlightedItem = ev.currentTarget
        .closest('[data-combobox-root]')
        ?.querySelector('[data-highlighted="true"]');

      // Only add custom value if no item is highlighted and allowCustomValues is true
      if (
        !hasHighlightedItem &&
        props.allowCustomValues &&
        inputValue.trim() &&
        !filteredItems.some(item => item.value === inputValue.trim())
      ) {
        ev.preventDefault();
        addItem(inputValue.trim());
      }
    } else if (ev.key === 'Backspace' && inputValue === '' && props.selectedValues.length > 0) {
      // Remove last selected item when backspace is pressed on empty input
      ev.preventDefault();
      props.onSelectionChange(props.selectedValues.slice(0, -1));
    }
  };

  // Get label for selected value
  const getItemLabel = (value: string) => {
    return props.availableItems.find(item => item.value === value)?.label ?? value;
  };

  // If indeterminate, render a simplified disabled version
  if (props.isIndeterminate) {
    return (
      <div
        className={styles.cmpMultiSelect}
        {...extractDataAttributes(props)}
        data-field-state="indeterminate"
        style={props.style ?? {}}
      >
        <div className={styles.cmpMultiSelectContainer}>
          <div className={styles.cmpMultiSelectTags}>
            <input
              {...PropsUtils.filterDomProperties(props)}
              type="text"
              value=""
              placeholder="···"
              disabled={true}
              className={styles.cmpMultiSelectInput}
              readOnly
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <BaseUICombobox.Root
      value={props.selectedValues}
      onValueChange={handleValueChange}
      inputValue={inputValue}
      onInputValueChange={handleInputValueChange}
      multiple={true}
      disabled={props.disabled}
    >
      <div
        className={styles.cmpMultiSelect}
        {...extractDataAttributes(props)}
        data-field-state={props.state}
        data-combobox-root
        style={props.style ?? {}}
      >
        <div className={styles.cmpMultiSelectContainer}>
          <div className={styles.cmpMultiSelectTags}>
            <BaseUICombobox.Chips className={styles.cmpMultiSelectChipsContainer}>
              {props.selectedValues.map((value, index) => (
                <BaseUICombobox.Chip key={`${value}-${index}`} className={styles.cmpMultiSelectTag}>
                  <span className={styles.cmpMultiSelectTagText}>{getItemLabel(value)}</span>
                  <BaseUICombobox.ChipRemove
                    className={styles.cmpMultiSelectTagRemove}
                    tabIndex={-1}
                  >
                    <TbX />
                  </BaseUICombobox.ChipRemove>
                </BaseUICombobox.Chip>
              ))}
            </BaseUICombobox.Chips>

            <BaseUICombobox.Input
              {...PropsUtils.filterDomProperties(props)}
              className={styles.cmpMultiSelectInput}
              placeholder={
                props.selectedValues.length === 0
                  ? (props.placeholder ?? 'Search and select...')
                  : ''
              }
              onKeyDown={handleInputKeyDown}
            />
          </div>
        </div>

        {/* Suggestions dropdown - only show when there are items */}
        {filteredItems.length > 0 && (
          <BaseUICombobox.Portal container={portal}>
            <BaseUICombobox.Positioner side="bottom" align="start" sideOffset={2}>
              <BaseUICombobox.Popup className={styles.cmpMultiSelectSuggestions}>
                <BaseUICombobox.List>
                  {filteredItems.map(item => (
                    <BaseUICombobox.Item
                      key={item.value}
                      value={item.value}
                      className={styles.cmpMultiSelectSuggestion}
                    >
                      {item.label}
                    </BaseUICombobox.Item>
                  ))}
                </BaseUICombobox.List>
              </BaseUICombobox.Popup>
            </BaseUICombobox.Positioner>
          </BaseUICombobox.Portal>
        )}
      </div>
    </BaseUICombobox.Root>
  );
};

type Props = {
  selectedValues: string[];
  availableItems: MultiSelectItem[];
  onSelectionChange: (values: string[]) => void;
  onInputChange?: (value: string, ev: ChangeEvent<HTMLInputElement>) => void;
  maxSuggestions?: number;
  allowCustomValues?: boolean;
  isIndeterminate?: boolean;
  state?: 'set' | 'unset' | 'overridden';
} & Omit<
  React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
  'onChange' | 'value' | 'onKeyDown' | 'onFocus' | 'onBlur'
>;
