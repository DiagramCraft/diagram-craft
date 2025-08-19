import React, { ChangeEvent, KeyboardEvent, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { propsUtils } from '@diagram-craft/utils/propsUtils';
import { extractDataAttributes } from './utils';
import styles from './TagInput.module.css';
import { Button } from './Button';
import { TbX } from 'react-icons/tb';
import { usePortal } from './PortalContext';

export const TagInput = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const portal = usePortal();

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

  // Filter available tags based on input and exclude already selected tags
  const filteredSuggestions = props.availableTags
    .filter(
      tag =>
        tag.toLowerCase().includes(inputValue.toLowerCase()) && !props.selectedTags.includes(tag)
    )
    .slice(0, props.maxSuggestions ?? 10);

  const addTag = (tag: string) => {
    if (tag.trim() && !props.selectedTags.includes(tag.trim())) {
      props.onTagsChange([...props.selectedTags, tag.trim()]);
      setInputValue('');
      setShowSuggestions(false);
      setSelectedSuggestion(-1);
    }
  };

  const removeTag = (tagToRemove: string) => {
    props.onTagsChange(props.selectedTags.filter(tag => tag !== tagToRemove));
  };

  const handleInputChange = (ev: ChangeEvent<HTMLInputElement>) => {
    if (props.isIndeterminate) return;

    const value = ev.target.value;
    setInputValue(value);

    // Check if there are suggestions for the new value
    const newFilteredSuggestions = props.availableTags
      .filter(
        tag => tag.toLowerCase().includes(value.toLowerCase()) && !props.selectedTags.includes(tag)
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
        addTag(filteredSuggestions[selectedSuggestion]);
      } else if (inputValue.trim()) {
        addTag(inputValue.trim());
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
    } else if (ev.key === 'Backspace' && inputValue === '' && props.selectedTags.length > 0) {
      removeTag(props.selectedTags[props.selectedTags.length - 1]);
    }
  };

  const handleSuggestionSelect = (tag: string) => {
    addTag(tag);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (tag: string) => {
    handleSuggestionSelect(tag);
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

  return (
    <>
      <div
        className={styles.cmpTagInput}
        {...extractDataAttributes(props)}
        data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
        style={props.style ?? {}}
      >
        <div className={styles.cmpTagInputContainer} ref={containerRef}>
          <div className={styles.cmpTagInputTags}>
            {!props.isIndeterminate &&
              props.selectedTags.map((tag, index) => (
                <div key={`${tag}-${index}`} className={styles.cmpTagInputTag}>
                  <span className={styles.cmpTagInputTagText}>{tag}</span>
                  <Button
                    type="icon-only"
                    className={styles.cmpTagInputTagRemove}
                    onClick={() => removeTag(tag)}
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
                  : props.selectedTags.length === 0
                    ? (props.placeholder ?? 'Add tags...')
                    : ''
              }
              disabled={props.disabled}
              className={styles.cmpTagInputInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
        </div>
      </div>

      {/* Portal-based suggestions dropdown */}
      {!props.isIndeterminate &&
        showSuggestions &&
        filteredSuggestions.length > 0 &&
        portal &&
        createPortal(
          <div
            className={styles.cmpTagInputSuggestions}
            style={{
              position: 'absolute',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: 1000
            }}
          >
            {filteredSuggestions.map((tag, index) => (
              <div
                key={tag}
                className={styles.cmpTagInputSuggestion}
                data-selected={index === selectedSuggestion}
                onMouseDown={() => handleSuggestionClick(tag)}
                onMouseEnter={() => setSelectedSuggestion(index)}
              >
                {tag}
              </div>
            ))}
          </div>,
          portal
        )}
    </>
  );
});

type Props = {
  selectedTags: string[];
  availableTags: string[];
  onTagsChange: (tags: string[]) => void;
  onInputChange?: (value: string, ev: ChangeEvent<HTMLInputElement>) => void;
  maxSuggestions?: number;
  isIndeterminate?: boolean;
  state?: 'set' | 'unset' | 'overridden';
} & Omit<
  React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
  'onChange' | 'value' | 'onKeyDown' | 'onFocus' | 'onBlur'
>;
