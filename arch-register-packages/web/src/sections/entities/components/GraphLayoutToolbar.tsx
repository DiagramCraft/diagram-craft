import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { TbSettings } from 'react-icons/tb';
import { ToolbarButton } from '../../../components/ToolbarButton';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Popover } from '@diagram-craft/app-components/Popover';
import { FilterDropdown } from '../../../components/FilterDropdown';
import type { LayoutAlgorithm, LayoutOptions } from '../../../components/DependencyGraph';
import styles from './EntityGraphView.module.css';

type Props = {
  layout: LayoutAlgorithm;
  setLayout: (layout: LayoutAlgorithm) => void;
  layoutOptions: LayoutOptions;
  setLayoutOptions: Dispatch<SetStateAction<LayoutOptions>>;
  betweenLayoutAndSettings?: ReactNode;
};

export const GraphLayoutToolbar = ({
  layout,
  setLayout,
  layoutOptions,
  setLayoutOptions,
  betweenLayoutAndSettings
}: Props) => {
  return (
    <>
      <FilterDropdown
        label="Layout"
        value={layout}
        onChange={value => setLayout(value as LayoutAlgorithm)}
        options={[
          { value: 'hierarchy', label: 'Hierarchy' },
          { value: 'layered', label: 'Layered' },
          { value: 'force', label: 'Force-directed' },
          { value: 'tree', label: 'Tree' }
        ]}
      />

      {betweenLayoutAndSettings}

      <Popover.Root>
        <Popover.Trigger
          element={
            <ToolbarButton
              icon={<TbSettings size={13} />}
              title="Advanced layout settings"
              aria-label="Advanced layout settings"
            />
          }
        />
        <Popover.Content side="bottom" align="start" className={styles.advancedPopover}>
          <div className={styles.advancedHeader}>Layout settings</div>
          <div className={styles.advancedGroups}>
            {(layout === 'hierarchy' || layout === 'layered' || layout === 'tree') && (
              <div className={styles.advancedGrid}>
                <label className={styles.advancedRow}>
                  <span>H-Space</span>
                  <NumberInput
                    value={layoutOptions.horizontalSpacing ?? 200}
                    onChange={value =>
                      setLayoutOptions(previous => ({ ...previous, horizontalSpacing: value }))
                    }
                    min={50}
                    max={500}
                    step={10}
                  />
                </label>
                <label className={styles.advancedRow}>
                  <span>V-Space</span>
                  <NumberInput
                    value={layoutOptions.verticalSpacing ?? 108}
                    onChange={value =>
                      setLayoutOptions(previous => ({ ...previous, verticalSpacing: value }))
                    }
                    min={50}
                    max={300}
                    step={10}
                  />
                </label>
              </div>
            )}

            {(layout === 'hierarchy' || layout === 'layered') && (
              <div className={styles.advancedGrid}>
                <label className={styles.advancedRow}>
                  <span>Crossings</span>
                  <NumberInput
                    value={layoutOptions.crossingMinimizationIterations ?? 10}
                    onChange={value =>
                      setLayoutOptions(previous => ({
                        ...previous,
                        crossingMinimizationIterations: value
                      }))
                    }
                    min={1}
                    max={50}
                    step={1}
                  />
                </label>
              </div>
            )}

            {layout === 'force' && (
              <div className={styles.advancedGrid}>
                <label className={styles.advancedRow}>
                  <span>Iterations</span>
                  <NumberInput
                    value={layoutOptions.iterations ?? 300}
                    onChange={value =>
                      setLayoutOptions(previous => ({ ...previous, iterations: value }))
                    }
                    min={50}
                    max={1000}
                    step={50}
                  />
                </label>
                <label className={styles.advancedRow}>
                  <span>Spring</span>
                  <NumberInput
                    value={layoutOptions.springStrength ?? 0.5}
                    onChange={value =>
                      setLayoutOptions(previous => ({ ...previous, springStrength: value }))
                    }
                    min={0.1}
                    max={2.0}
                    step={0.1}
                  />
                </label>
                <label className={styles.advancedRow}>
                  <span>Repulsion</span>
                  <NumberInput
                    value={layoutOptions.repulsionStrength ?? 1.0}
                    onChange={value =>
                      setLayoutOptions(previous => ({ ...previous, repulsionStrength: value }))
                    }
                    min={0.1}
                    max={3.0}
                    step={0.1}
                  />
                </label>
                <label className={styles.advancedRow}>
                  <span>Length</span>
                  <NumberInput
                    value={layoutOptions.idealEdgeLength ?? 160}
                    onChange={value =>
                      setLayoutOptions(previous => ({ ...previous, idealEdgeLength: value }))
                    }
                    min={50}
                    max={500}
                    step={10}
                  />
                </label>
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Root>
    </>
  );
};
