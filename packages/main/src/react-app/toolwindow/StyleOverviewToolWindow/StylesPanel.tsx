import styles from './StylesPanel.module.css';
import { ToolWindowPanel } from '../ToolWindowPanel';
import type {
  StyleCombination,
  StyleFilterType,
  StylesheetGroup,
  TextStyleCombination
} from './stylesPanelUtils';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { PickerCanvas } from '../../PickerCanvas';
import { PickerConfig } from '../PickerToolWindow/pickerConfig';
import { useMemo } from 'react';
import { TbLetterCase } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import { mustExist } from '@diagram-craft/utils/assert';

type StylesPanelProps = {
  groups: StylesheetGroup<StyleCombination>[];
  onStyleClick: (combo: StyleCombination) => void;
  filterType: StyleFilterType;
  onFilterTypeChange: (filterType: StyleFilterType) => void;
};

type TextStylesPanelProps = {
  groups: StylesheetGroup<TextStyleCombination>[];
  onTextStyleClick: (combo: TextStyleCombination) => void;
  filterType: StyleFilterType;
  onFilterTypeChange: (filterType: StyleFilterType) => void;
};

type FilterSelectProps = {
  filterType: StyleFilterType;
  onFilterTypeChange: (filterType: StyleFilterType) => void;
};

const FilterSelect = ({ filterType, onFilterTypeChange }: FilterSelectProps) => (
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
);

const EmptyStyleComponent = () => (
  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--base-fg-dim)' }}>
    No styles found
  </div>
);

export const StylesPanel = ({
  groups,
  onStyleClick,
  filterType,
  onFilterTypeChange
}: StylesPanelProps) => {
  const openItems = useMemo(() => groups.map(g => g.stylesheet?.id ?? 'no-stylesheet'), [groups]);

  return (
    <ToolWindowPanel mode={'headless-no-padding'} id={'styles-list'} title={'Styles'}>
      <FilterSelect filterType={filterType} onFilterTypeChange={onFilterTypeChange} />
      {groups.length === 0 ? (
        <EmptyStyleComponent />
      ) : (
        <Accordion.Root type={'multiple'} value={openItems}>
          {groups.map(group => {
            const groupId = group.stylesheet?.id ?? 'no-stylesheet';

            return (
              <Accordion.Item key={groupId} value={groupId}>
                <Accordion.ItemHeader>
                  <div className={styles.stylesheetName}>
                    <span>{group.stylesheet?.name}</span>
                    {group.stylesheet?.type && (
                      <span style={{ fontSize: '0.625rem', opacity: 0.7, marginLeft: '0.25rem' }}>
                        ({group.stylesheet?.type})
                      </span>
                    )}
                  </div>
                </Accordion.ItemHeader>
                <Accordion.ItemContent>
                  <div className={styles.styleList}>
                    {group.styles.map((style, idx) => {
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
                              diagram={mustExist(style.previewDiagram)}
                              showHover={false}
                              onMouseDown={() => onStyleClick(style)}
                            />
                          </div>
                          <div className={styles.styleInfo}>
                            <div className={styles.styleCount}>
                              {style.differences.length}
                              {style.differences.length > 0 && (
                                <span className={styles.styleDirty}>*</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );

                      return style.differences.length > 0 ? (
                        <Tooltip
                          key={`${groupId}-${idx}`}
                          message={
                            <div className={styles.styleTooltip}>
                              {style.differences.join('\n')}
                            </div>
                          }
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
  const openItems = useMemo(() => groups.map(g => g.stylesheet?.id ?? 'no-stylesheet'), [groups]);

  return (
    <ToolWindowPanel mode={'headless-no-padding'} id={'text-styles-list'} title={'Text Styles'}>
      <FilterSelect filterType={filterType} onFilterTypeChange={onFilterTypeChange} />
      {groups.length === 0 ? (
        <EmptyStyleComponent />
      ) : (
        <Accordion.Root type={'multiple'} value={openItems}>
          {groups.map(group => {
            const groupId = group.stylesheet?.id ?? 'no-stylesheet';

            return (
              <Accordion.Item key={groupId} value={groupId}>
                <Accordion.ItemHeader>
                  <div className={styles.stylesheetName}>
                    <span>{group.stylesheet?.name}</span>
                    {group.stylesheet?.type && (
                      <span style={{ fontSize: '0.625rem', opacity: 0.7, marginLeft: '0.25rem' }}>
                        ({group.stylesheet?.type})
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
                                {textStyle.elements.length} element(s)
                                {textStyle.differences.length > 0 && (
                                  <span className={styles.fontDirty}>*</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );

                      return textStyle.differences.length > 0 ? (
                        <Tooltip
                          key={key}
                          message={
                            <div className={styles.styleTooltip}>
                              {textStyle.differences.join('\n')}
                            </div>
                          }
                          element={fontItem}
                        />
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
