import styles from './ColorsPanel.module.css';
import { ToolWindowPanel } from '../ToolWindowPanel';
import type { ColorCombination } from './colorsPanelUtils';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';

type ColorsPanelProps = {
  colors: ColorCombination[];
  onColorClick: (combo: ColorCombination) => void;
  onUsageClick: (combo: ColorCombination, usageType: 'background' | 'text' | 'border') => void;
};

export const ColorsPanel = ({ colors, onColorClick, onUsageClick }: ColorsPanelProps) => {
  return (
    <ToolWindowPanel mode={'headless'} id={'colors-list'} title={'Colors'}>
      {colors.length === 0 ? (
        <div style={{ padding: '0.625rem 1rem', textAlign: 'center', color: 'var(--base-fg-dim)' }}>
          No colors found
        </div>
      ) : (
        <div className={styles.colorList}>
          {colors.map(combo => {
            const key = combo.color;

            return (
              <Tooltip
                key={key}
                message={combo.color}
                element={
                  <div
                    className={styles.colorItem}
                    onClick={() => {
                      onColorClick(combo);
                    }}
                  >
                    <div className={styles.colorSwatch} style={{ backgroundColor: combo.color }} />

                    <div className={styles.usageBadges}>
                      {combo.backgroundCount > 0 && (
                        <div
                          className={styles.usageBadge}
                          onClick={e => {
                            e.stopPropagation();
                            onUsageClick(combo, 'background');
                          }}
                        >
                          {combo.backgroundCount} background{combo.backgroundCount !== 1 ? 's' : ''}
                        </div>
                      )}
                      {combo.textCount > 0 && (
                        <div
                          className={styles.usageBadge}
                          onClick={e => {
                            e.stopPropagation();
                            onUsageClick(combo, 'text');
                          }}
                        >
                          {combo.textCount} text{combo.textCount !== 1 ? 's' : ''}
                        </div>
                      )}
                      {combo.borderCount > 0 && (
                        <div
                          className={styles.usageBadge}
                          onClick={e => {
                            e.stopPropagation();
                            onUsageClick(combo, 'border');
                          }}
                        >
                          {combo.borderCount} border{combo.borderCount !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </ToolWindowPanel>
  );
};
