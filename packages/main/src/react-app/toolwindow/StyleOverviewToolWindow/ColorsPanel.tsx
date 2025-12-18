import styles from './ColorsPanel.module.css';
import { ToolWindowPanel } from '../ToolWindowPanel';
import type { ColorInfo, StylesheetGroup } from './colorsPanelUtils';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { useMemo } from 'react';

type ColorsPanelProps = {
  groups: StylesheetGroup[];
  onColorClick: (color: ColorInfo) => void;
};

const ColorTypeSection = ({
  title,
  colors,
  onColorClick
}: {
  title: string;
  colors: ColorInfo[];
  onColorClick: (color: ColorInfo) => void;
}) => {
  if (colors.length === 0) return null;

  return (
    <div className={styles.colorTypeSection}>
      <div className={styles.colorTypeTitle}>{title}</div>
      <div className={styles.colorGrid}>
        {colors.map((color, idx) => (
          <Tooltip
            key={idx}
            message={color.color}
            element={
              <div className={styles.colorItem} onClick={() => onColorClick(color)}>
                <div
                  className={styles.colorSwatch}
                  style={{ backgroundColor: color.color }}
                />
                <div className={styles.colorCount}>
                  {color.count}
                  {color.isDirty && <span className={styles.colorDirty}>*</span>}
                </div>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
};

export const ColorsPanel = ({ groups, onColorClick }: ColorsPanelProps) => {
  // Keep all accordions open by default
  const openItems = useMemo(
    () => groups.map(g => g.stylesheetId ?? 'no-stylesheet'),
    [groups]
  );

  if (groups.length === 0) {
    return (
      <ToolWindowPanel mode={'headless'} id={'colors-list'} title={'Colors'}>
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--base-fg-dim)' }}>
          No colors found
        </div>
      </ToolWindowPanel>
    );
  }

  return (
    <ToolWindowPanel mode={'headless-no-padding'} id={'colors-list'} title={'Colors'}>
      <Accordion.Root
        type={'multiple'}
        value={openItems}
      >
        {groups.map(group => {
          const groupId = group.stylesheetId ?? 'no-stylesheet';
          const hasColors =
            group.colors.backgrounds.length > 0 ||
            group.colors.text.length > 0 ||
            group.colors.borders.length > 0;

          if (!hasColors) return null;

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
                <ColorTypeSection
                  title="Backgrounds"
                  colors={group.colors.backgrounds}
                  onColorClick={onColorClick}
                />
                <ColorTypeSection
                  title="Text"
                  colors={group.colors.text}
                  onColorClick={onColorClick}
                />
                <ColorTypeSection
                  title="Borders"
                  colors={group.colors.borders}
                  onColorClick={onColorClick}
                />
              </Accordion.ItemContent>
            </Accordion.Item>
          );
        })}
      </Accordion.Root>
    </ToolWindowPanel>
  );
};
