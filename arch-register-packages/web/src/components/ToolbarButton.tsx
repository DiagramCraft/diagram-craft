import { Button } from '@diagram-craft/app-components/Button';
import React from 'react';
import styles from './ToolbarButton.module.css';

/**
 * A small button sized and bordered to sit next to `FilterDropdown`s in a view's config bar (26px
 * tall in total, panel border).
 */
export const ToolbarButton = React.forwardRef<HTMLButtonElement, Omit<Button.Props, 'size'>>(
  ({ className, ...props }, ref) => (
    <Button
      {...props}
      ref={ref}
      size="sm"
      className={`${styles.toolbarButton} ${className ?? ''}`}
    />
  )
);
