import React, { ChangeEvent, KeyboardEvent, useRef, useState, useLayoutEffect } from 'react';
import * as Portal from '@radix-ui/react-portal';
import { propsUtils } from '@diagram-craft/utils/propsUtils';
import { extractDataAttributes } from './utils';
import styles from './MultiSelect.module.css';
import { Button } from './Button';
import { TbX } from 'react-icons/tb';

export type MultiSelectItem = {
  value: string;
  label: string;
};

export const MultiSelect = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Combine external ref with internal ref
  React.useImperativeHandle(ref, () => inputRef.current!);

  // Update dropdown position based on input container position
  const updateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  // Update position when suggestions are shown
  useLayoutEffect(() => {
    if (showSuggestions) {
      updateDropdownPosition();
    }
  }, [showSuggestions]);

  // Filter available items based on input and exclude already selected items
  const filteredSuggestions = props.availableItems
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
      setShowSuggestions(false);
      setSelectedSuggestion(-1);
    }
  };

  const removeItem = (valueToRemove: string) => {
    props.onSelectionChange(props.selectedValues.filter(value => value !== valueToRemove));
  };

  const handleInputChange = (ev: ChangeEvent<HTMLInputElement>) => {
    if (props.isIndeterminate) return;

    const value = ev.target.value;
    setInputValue(value);

    // Check if there are suggestions for the new value
    const newFilteredSuggestions = props.availableItems
      .filter(
        item =>
          item.label.toLowerCase().includes(value.toLowerCase()) &&
          !props.selectedValues.includes(item.value)
      )
      .slice(0, props.maxSuggestions ?? 10);

    setShowSuggestions(value.length > 0 && newFilteredSuggestions.length > 0);
    setSelectedSuggestion(-1);
    props.onInputChange?.(value, ev);
  };

  const handleKeyDown = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (props.isIndeterminate) return;

    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (selectedSuggestion >= 0 && filteredSuggestions[selectedSuggestion]) {
        addItem(filteredSuggestions[selectedSuggestion].value);
      }
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (showSuggestions && filteredSuggestions.length > 0) {
        setSelectedSuggestion(Math.min(selectedSuggestion + 1, filteredSuggestions.length - 1));
      }
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (showSuggestions && filteredSuggestions.length > 0) {
        setSelectedSuggestion(Math.max(selectedSuggestion - 1, -1));
      }
    } else if (ev.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestion(-1);
    } else if (ev.key === 'Backspace' && inputValue === '' && props.selectedValues.length > 0) {
      removeItem(props.selectedValues[props.selectedValues.length - 1]);
    }
  };

  const handleSuggestionSelect = (value: string) => {
    addItem(value);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (value: string) => {
    handleSuggestionSelect(value);
  };

  const handleInputFocus = () => {
    if (props.isIndeterminate) return;

    // Only show suggestions if there's input text and matching suggestions
    if (inputValue.length > 0 && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedSuggestion(-1);
    }, 150);
  };

  // Get label for selected value
  const getItemLabel = (value: string) => {
    return props.availableItems.find(item => item.value === value)?.label ?? value;
  };

  return (
    <>
      <div
        className={styles.cmpMultiSelect}
        {...extractDataAttributes(props)}
        data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
        style={props.style ?? {}}
      >
        <div className={styles.cmpMultiSelectContainer} ref={containerRef}>
          <div className={styles.cmpMultiSelectTags}>
            {!props.isIndeterminate &&
              props.selectedValues.map((value, index) => (
                <div key={`${value}-${index}`} className={styles.cmpMultiSelectTag}>
                  <span className={styles.cmpMultiSelectTagText}>{getItemLabel(value)}</span>
                  <Button
                    type="icon-only"
                    className={styles.cmpMultiSelectTagRemove}
                    onClick={() => removeItem(value)}
                    tabIndex={-1}
                  >
                    <TbX />
                  </Button>
                </div>
              ))}

            <input
              ref={inputRef}
              {...propsUtils.filterDomProperties(props)}
              type="text"
              value={props.isIndeterminate ? '' : inputValue}
              placeholder={
                props.isIndeterminate
                  ? '···'
                  : props.selectedValues.length === 0
                    ? (props.placeholder ?? 'Search and select...')
                    : ''
              }
              disabled={props.disabled}
              className={styles.cmpMultiSelectInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
        </div>
      </div>

      {/* Portal-based suggestions dropdown */}
      {!props.isIndeterminate && showSuggestions && filteredSuggestions.length > 0 && (
        <Portal.Root>
          <div
            className={styles.cmpMultiSelectSuggestions}
            style={{
              position: 'absolute',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: 1000
            }}
          >
            {filteredSuggestions.map((item, index) => (
              <div
                key={item.value}
                className={styles.cmpMultiSelectSuggestion}
                data-selected={index === selectedSuggestion}
                onMouseDown={() => handleSuggestionClick(item.value)}
                onMouseEnter={() => setSelectedSuggestion(index)}
              >
                {item.label}
              </div>
            ))}
          </div>
        </Portal.Root>
      )}
    </>
  );
});

type Props = {
  selectedValues: string[];
  availableItems: MultiSelectItem[];
  onSelectionChange: (values: string[]) => void;
  onInputChange?: (value: string, ev: ChangeEvent<HTMLInputElement>) => void;
  maxSuggestions?: number;
  isIndeterminate?: boolean;
  state?: 'set' | 'unset' | 'overridden';
} & Omit<
  React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
  'onChange' | 'value' | 'onKeyDown' | 'onFocus' | 'onBlur'
>;