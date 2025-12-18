import styles from './StylesPanel.module.css';
import { ToolWindowPanel } from '../ToolWindowPanel';
import type {
  StyleCombination,
  StyleFilterType,
  StylesheetGroup,
  TextStyleCombination,
  TextStylesheetGroup
} from './stylesPanelUtils';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { PickerCanvas } from '../../PickerCanvas';
import { PickerConfig } from '../PickerToolWindow/pickerConfig';
import { useMemo } from 'react';
import { TbLetterCase } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';

type StylesPanelProps = {
  groups: StylesheetGroup[];
  onStyleClick: (combo: StyleCombination) => void;
  filterType: StyleFilterType;
  onFilterTypeChange: (filterType: StyleFilterType) => void;
};

type TextStylesPanelProps = {
  groups: TextStylesheetGroup[];
  onTextStyleClick: (combo: TextStyleCombination) => void;
  filterType: StyleFilterType;
  onFilterTypeChange: (filterType: StyleFilterType) => void;
};

export const StylesPanel = ({
  groups,
  onStyleClick,
  filterType,
  onFilterTypeChange
}: StylesPanelProps) => {
  // Keep all accordions open by default
  const openItems = useMemo(() => groups.map(g => g.stylesheetId ?? 'no-stylesheet'), [groups]);

  return (
    <ToolWindowPanel mode={'headless-no-padding'} id={'styles-list'} title={'Styles'}>
      <div className={styles.styleSelect}>
        <Select.Root
          value={filterType}
          onChange={value => onFilterTypeChange(value as StyleFilterType)}
        >
          <Select.Item value="all">All Properties</Select.Item>
          <Select.Item value="fill">Fill</Select.Item>
          <Select.Item value="stroke">Stroke</Select.Item>
          <Select.Item value="shadow">Shadow</Select.Item>
          <Select.Item value="effects">Effects</Select.Item>
          <Select.Item value="text">Text</Select.Item>
        </Select.Root>
      </div>
      {groups.length === 0 ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--base-fg-dim)' }}>
          No styles found
        </div>
      ) : (
        <Accordion.Root type={'multiple'} value={openItems}>
          {groups.map(group => {
            const groupId = group.stylesheetId ?? 'no-stylesheet';

            return (
              <Accordion.Item key={groupId} value={groupId}>
                <Accordion.ItemHeader>
                  <div className={styles.stylesheetName}>
                    <span>{group.stylesheetName}</span>
                    {group.stylesheetType && (
                      <span style={{ fontSize: '0.625rem', opacity: 0.7, marginLeft: '0.25rem' }}>
                        ({group.stylesheetType})
                      </span>
                    )}
                  </div>
                </Accordion.ItemHeader>
                <Accordion.ItemContent>
                  <div className={styles.styleList}>
                    {group.styles.map((style, idx) => {
                      // Use cached differences
                      const tooltipContent =
                        style.differences.length > 0 ? (
                          <div
                            key={`${groupId}-${idx}`}
                            style={{
                              whiteSpace: 'pre-line',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem'
                            }}
                          >
                            {style.differences.join('\n')}
                          </div>
                        ) : null;

                      const styleItem = (
                        <div
                          key={`${groupId}-${idx}`}
                          className={styles.styleItem}
                          onClick={() => onStyleClick(style)}
                        >
                          <div className={styles.stylePreview}>
                            <PickerCanvas
                              width={PickerConfig.size}
                              height={PickerConfig.size}
                              diagram={style.previewDiagram}
                              showHover={false}
                              onMouseDown={() => onStyleClick(style)}
                            />
                          </div>
                          <div className={styles.styleInfo}>
                            <div className={styles.styleCount}>
                              {style.count}
                              {style.isDirty && <span className={styles.styleDirty}>*</span>}
                            </div>
                          </div>
                        </div>
                      );

                      return tooltipContent ? (
                        <Tooltip
                          key={`${groupId}-${idx}`}
                          message={tooltipContent}
                          element={styleItem}
                        />
                      ) : (
                        styleItem
                      );
                    })}
                  </div>
                </Accordion.ItemContent>
              </Accordion.Item>
            );
          })}
        </Accordion.Root>
      )}
    </ToolWindowPanel>
  );
};

export const TextStylesPanel = ({
  groups,
  onTextStyleClick,
  filterType,
  onFilterTypeChange
}: TextStylesPanelProps) => {
  // Keep all accordions open by default
  const openItems = useMemo(() => groups.map(g => g.stylesheetId ?? 'no-stylesheet'), [groups]);

  return (
    <ToolWindowPanel mode={'headless-no-padding'} id={'text-styles-list'} title={'Text Styles'}>
      <div className={styles.styleSelect}>
        <Select.Root
          value={filterType}
          onChange={value => onFilterTypeChange(value as StyleFilterType)}
        >
          <Select.Item value="all">All Properties</Select.Item>
          <Select.Item value="fill">Fill</Select.Item>
          <Select.Item value="stroke">Stroke</Select.Item>
          <Select.Item value="shadow">Shadow</Select.Item>
          <Select.Item value="effects">Effects</Select.Item>
          <Select.Item value="text">Text</Select.Item>
        </Select.Root>
      </div>
      {groups.length === 0 ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--base-fg-dim)' }}>
          No text styles found
        </div>
      ) : (
        <Accordion.Root type={'multiple'} value={openItems}>
          {groups.map(group => {
            const groupId = group.stylesheetId ?? 'no-stylesheet';

            return (
              <Accordion.Item key={groupId} value={groupId}>
                <Accordion.ItemHeader>
                  <div className={styles.stylesheetName}>
                    <span>{group.stylesheetName}</span>
                    {group.stylesheetType && (
                      <span style={{ fontSize: '0.625rem', opacity: 0.7, marginLeft: '0.25rem' }}>
                        ({group.stylesheetType})
                      </span>
                    )}
                  </div>
                </Accordion.ItemHeader>
                <Accordion.ItemContent>
                  <div className={styles.fontList}>
                    {group.styles.map((textStyle, idx) => {
                      const key = `${groupId}-${idx}`;
                      const fontStyle = {
                        fontFamily: textStyle.props.text.font,
                        fontSize: `${Math.min(textStyle.props.text.fontSize, 14)}px`,
                        fontWeight: textStyle.props.text.bold ? 'bold' : 'normal',
                        fontStyle: textStyle.props.text.italic ? 'italic' : 'normal'
                      };

                      const metaParts = [
                        `${textStyle.props.text.fontSize}px`,
                        textStyle.props.text.bold && 'Bold',
                        textStyle.props.text.italic && 'Italic',
                        textStyle.props.text.color
                      ].filter(Boolean);

                      // Use cached differences
                      const tooltipContent =
                        textStyle.differences.length > 0 ? (
                          <div
                            key={key}
                            style={{
                              whiteSpace: 'pre-line',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem'
                            }}
                          >
                            {textStyle.differences.join('\n')}
                          </div>
                        ) : null;

                      const fontItem = (
                        <div
                          key={key}
                          className={styles.fontItem}
                          onClick={() => onTextStyleClick(textStyle)}
                        >
                          <div className={styles.fontIcon}>
                            <TbLetterCase size={18} />
                          </div>
                          <div className={styles.fontDetails}>
                            <div className={styles.fontPreview} style={fontStyle}>
                              {textStyle.props.text.font}
                            </div>
                            <div className={styles.fontCount}>
                              {metaParts.join(', ')}
                              <div>
                                {textStyle.elements.length} element
                                {textStyle.elements.length !== 1 ? 's' : ''}
                                {textStyle.differences.length > 0 && (
                                  <span className={styles.fontDirty}>*</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );

                      return tooltipContent ? (
                        <Tooltip key={key} message={tooltipContent} element={fontItem} />
                      ) : (
                        fontItem
                      );
                    })}
                  </div>
                </Accordion.ItemContent>
              </Accordion.Item>
            );
          })}
        </Accordion.Root>
      )}
    </ToolWindowPanel>
  );
};
