import { useDocument } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { TbTag } from 'react-icons/tb';
import styles from './TagsToolWindow.module.css';

export const TagsToolWindow = () => {
  const document = useDocument();
  const redraw = useRedraw();

  useEventListener(document.tags, 'update', redraw);

  return (
    <Accordion.Root disabled={true} type="multiple" defaultValue={['tags']}>
      <Accordion.Item value="tags">
        <Accordion.ItemHeader>Document Tags</Accordion.ItemHeader>
        <Accordion.ItemContent>
          <div className={styles.tagsWindow}>
            <div className={styles.tagsList}>
              {document.tags.tags.length === 0 ? (
                <div className={styles.tagsEmpty}>No tags</div>
              ) : (
                document.tags.tags.map((tag) => (
                  <div key={tag} className={styles.tagItem}>
                    <TbTag className={styles.tagIcon} />
                    <span className={styles.tagText}>{tag}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Accordion.ItemContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};