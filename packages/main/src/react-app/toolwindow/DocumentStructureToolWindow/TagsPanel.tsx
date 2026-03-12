import { useDocument } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { TbTag } from 'react-icons/tb';
import styles from './TagsPanel.module.css';
import { ToolWindowPanel } from '../ToolWindowPanel';

export const TagsPanel = () => {
  const document = useDocument();
  const redraw = useRedraw();

  useEventListener(document.tags, 'update', redraw);
  useEventListener(document.tags, 'selectionUpdate', redraw);

  const handleTagClick = (tag: string) => {
    document.tags.toggleTagSelection(tag);
  };

  return (
    <ToolWindowPanel mode={'headless-no-padding'} id={'tags'} title={'Tags'}>
      <div className={styles.icTagsPanel}>
        <div className={styles.eTagList}>
          {document.tags.tags.length === 0 ? (
            <div className={styles.eEmptyMessage}>
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
                  className={styles.eTag}
                  data-selected={isSelected}
                  onClick={() => handleTagClick(tag)}
                >
                  <TbTag className={styles.eIcon} />
                  <span className={styles.eText}>{tag}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </ToolWindowPanel>
  );
};
