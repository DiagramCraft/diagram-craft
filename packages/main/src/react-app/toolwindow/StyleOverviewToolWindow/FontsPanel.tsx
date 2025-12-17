import styles from './FontsPanel.module.css';
import { ToolWindowPanel } from '../ToolWindowPanel';
import type { FontCombination, StylesheetGroup } from './fontsPanelUtils';
import { TbLetterCase } from 'react-icons/tb';
import { Accordion } from '@diagram-craft/app-components/Accordion';

type FontsPanelProps = {
  groups: StylesheetGroup[];
  onFontClick: (combo: FontCombination) => void;
};

export const FontsPanel = ({ groups, onFontClick }: FontsPanelProps) => {
  if (groups.length === 0) {
    return (
      <ToolWindowPanel mode={'headless'} id={'fonts-list'} title={'Fonts'}>
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--base-fg-dim)' }}>
          No text elements found
        </div>
      </ToolWindowPanel>
    );
  }

  return (
    <ToolWindowPanel mode={'headless-no-padding'} id={'fonts-list'} title={'Fonts'}>
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
                <div className={styles.fontList}>
                  {group.fonts.map(combo => {
                    const key = `${combo.fontFamily}-${combo.fontSize}-${combo.bold}-${combo.italic}`;
                    const fontStyle = {
                      fontFamily: combo.fontFamily,
                      fontSize: `${Math.min(combo.fontSize, 14)}px`,
                      fontWeight: combo.bold ? 'bold' : 'normal',
                      fontStyle: combo.italic ? 'italic' : 'normal'
                    };

                    const fontDescription = [
                      combo.fontFamily,
                      `${combo.fontSize}px`,
                      combo.bold && 'Bold',
                      combo.italic && 'Italic'
                    ]
                      .filter(Boolean)
                      .join(', ');

                    return (
                      <div
                        key={key}
                        className={styles.fontItem}
                        onClick={() => onFontClick(combo)}
                      >
                        <div className={styles.fontIcon}>
                          <TbLetterCase />
                        </div>
                        <div className={styles.fontDetails}>
                          <div className={styles.fontPreview} style={fontStyle}>
                            {fontDescription}
                          </div>
                          <div className={styles.fontCount}>
                            {combo.count} element{combo.count !== 1 ? 's' : ''}
                            {combo.isDirty && <span className={styles.fontDirty}>*</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Accordion.ItemContent>
            </Accordion.Item>
          );
        })}
      </Accordion.Root>
    </ToolWindowPanel>
  );
};
