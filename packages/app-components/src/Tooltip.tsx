import React, { type ReactElement } from 'react';
import styles from './Tooltip.module.css';
import { Tooltip as BaseUITooltip } from '@base-ui/react/tooltip';

let hidePopupRuleId: number[] = [];

export const enablePropertyEditorTooltip = () => {
  if (hidePopupRuleId !== undefined) {
    const stylesheet = document.styleSheets[0]!;
    hidePopupRuleId.forEach(r => stylesheet.deleteRule(r));
    hidePopupRuleId = [];
  }
};

export const disablePropertyEditorTooltip = () => {
  const stylesheet = document.styleSheets[0]!;
  hidePopupRuleId.push(stylesheet.insertRule('.cmp-tooltip { display: none !important; }', 0));
};

export const Tooltip = (props: Props) => {
  return (
    <BaseUITooltip.Provider>
      <BaseUITooltip.Root>
        <BaseUITooltip.Trigger render={props.element} />
        <BaseUITooltip.Portal>
          <BaseUITooltip.Positioner sideOffset={5} side={'bottom'}>
            <BaseUITooltip.Popup className={styles.cmpTooltip}>
              {props.message}
              <BaseUITooltip.Arrow className={styles.cmpTooltipArrow} />
            </BaseUITooltip.Popup>
          </BaseUITooltip.Positioner>
        </BaseUITooltip.Portal>
      </BaseUITooltip.Root>
    </BaseUITooltip.Provider>
  );
};

type Props = {
  message: React.ReactNode;
  element: ReactElement;
};
