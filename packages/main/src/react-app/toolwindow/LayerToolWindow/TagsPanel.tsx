import { useDocument } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { TbTag } from 'react-icons/tb';
import styles from './TagsPanel.module.css';

export const TagsPanel = () => {
  const document = useDocument();
  const redraw = useRedraw();

  useEventListener(document.tags, 'update', redraw);
  useEventListener(document.tags, 'selectionUpdate', redraw);

  const handleTagClick = (tag: string) => {
    document.tags.toggleTagSelection(tag);
  };

  return (
    <div className={styles.tags}>
      <div className={styles.tags__list}>
        {document.tags.tags.length === 0 ? (
          <div className={styles.tagsEmpty}>
            No tags
            <br />
            <br />
            Tags assigned to elements <br />
            will be displayed here.
          </div>
        ) : (
          document.tags.tags.map(tag => {
            const isSelected = document.tags.isTagSelected(tag);
            return (
              <div
                key={tag}
                className={`${styles.tag} ${isSelected ? styles['tag--selected'] : ''}`}
                onClick={() => handleTagClick(tag)}
              >
                <TbTag className={styles.tagIcon} />
                <span className={styles.tagText}>{tag}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
