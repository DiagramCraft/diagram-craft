import { TbHelp } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover } from '@diagram-craft/app-components/Popover';
import type { BrowserView } from '@arch-register/api-types/viewContract';
import { BROWSER_VIEW_META } from './browserViewMeta';
import styles from './EntityBrowser.module.css';

export const ViewHelpPopover = ({ view, label }: { view: BrowserView; label: string }) => (
  <Popover.Root>
    <Popover.Trigger
      element={
        <Button
          size="sm"
          variant="ghost"
          icon={<TbHelp size={14} />}
          aria-label="About this view"
          title="About this view"
        />
      }
    />
    <Popover.Content sideOffset={4} align="end" arrow={false} className={styles.viewHelpPopover}>
      <div className={styles.viewHelpTitle}>{label}</div>
      <div className={styles.viewHelpText}>{BROWSER_VIEW_META[view].help}</div>
    </Popover.Content>
  </Popover.Root>
);
