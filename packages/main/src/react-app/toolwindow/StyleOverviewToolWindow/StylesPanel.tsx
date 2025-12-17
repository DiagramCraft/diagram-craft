import styles from './StylesPanel.module.css';
import { ToolWindowPanel } from '../ToolWindowPanel';
import type { StyleCombination, StylesheetGroup } from './stylesPanelUtils';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { PickerCanvas } from '../../PickerCanvas';
import { PickerConfig } from '../PickerToolWindow/pickerConfig';

type StylesPanelProps = {
  groups: StylesheetGroup[];
  onStyleClick: (combo: StyleCombination) => void;
};

export const StylesPanel = ({ groups, onStyleClick }: StylesPanelProps) => {
  if (groups.length === 0) {
    return (
      <ToolWindowPanel mode={'headless'} id={'styles-list'} title={'Styles'}>
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--base-fg-dim)' }}>
          No styles found
        </div>
      </ToolWindowPanel>
    );
  }

  return (
    <ToolWindowPanel mode={'headless-no-padding'} id={'styles-list'} title={'Styles'}>
      <Accordion.Root
        type={'multiple'}
        defaultValue={groups.map(g => g.stylesheetId ?? 'no-stylesheet')}
      >
        {groups.map(group => {
          const groupId = group.stylesheetId ?? 'no-stylesheet';

          return (
            <Accordion.Item key={groupId} value={groupId}>
              <Accordion.ItemHeader>
                <div className={styles.stylesheetName}>
                  <span>{group.stylesheetName}</span>
                  {group.stylesheetType && (
                    <span style={{ fontSize: '0.625rem', opacity: 0.7 }}>
                      ({group.stylesheetType})
                    </span>
                  )}
                </div>
              </Accordion.ItemHeader>
              <Accordion.ItemContent>
                <div className={styles.styleList}>
                  {group.styles.map((style, idx) => (
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
                  ))}
                </div>
              </Accordion.ItemContent>
            </Accordion.Item>
          );
        })}
      </Accordion.Root>
    </ToolWindowPanel>
  );
};
