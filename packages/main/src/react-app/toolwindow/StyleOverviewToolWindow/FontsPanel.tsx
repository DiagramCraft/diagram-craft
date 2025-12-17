import styles from './FontsPanel.module.css';
import { ToolWindowPanel } from '../ToolWindowPanel';
import type { FontCombination } from './fontsPanelUtils';
import { TbLetterCase } from 'react-icons/tb';

type FontsPanelProps = {
  fonts: FontCombination[];
  onFontClick: (combo: FontCombination) => void;
};

export const FontsPanel = ({ fonts, onFontClick }: FontsPanelProps) => {
  return (
    <ToolWindowPanel mode={'headless'} id={'fonts-list'} title={'Fonts'}>
      {fonts.length === 0 ? (
        <div style={{ padding: '0.625rem 1rem', textAlign: 'center', color: 'var(--base-fg-dim)' }}>
          No text elements found
        </div>
      ) : (
        <div className={styles.fontList}>
          {fonts.map(combo => {
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
              <div key={key} className={styles.fontItem} onClick={() => onFontClick(combo)}>
                <div className={styles.fontIcon}>
                  <TbLetterCase />
                </div>
                <div className={styles.fontDetails}>
                  <div className={styles.fontPreview} style={fontStyle}>
                    {fontDescription}
                  </div>
                  <div className={styles.fontCount}>
                    {combo.count} element{combo.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ToolWindowPanel>
  );
};
