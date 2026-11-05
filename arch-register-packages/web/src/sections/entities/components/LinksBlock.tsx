import type { Dispatch, SetStateAction } from 'react';
import { TbExternalLink } from 'react-icons/tb';
import { ListEditor } from '../../../components/ListEditor';
import type { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import styles from './EntityOverviewTab.module.css';

type LinksBlockProps = {
  entity: EntityRecord;
  editing: boolean;
  editLinks: EntitySummary['_links'];
  setEditLinks: Dispatch<SetStateAction<EntitySummary['_links']>>;
};

/** Renders the entity's arbitrary external `_links`, in either display or edit mode. */
export const LinksBlock = ({ entity, editing, editLinks, setEditLinks }: LinksBlockProps) =>
  editing ? (
    <div className={styles.linksEdit}>
      <ListEditor
        items={editLinks}
        onChange={setEditLinks}
        createItem={() => ({ url: '', title: '', type: '' })}
        addLabel="Add link"
        removeLabel="Remove link"
        renderItem={(l, { update }) => (
          <div className={styles.linkRow}>
            <input
              className={styles.inputInline}
              value={l.type ?? ''}
              onChange={e => update({ type: e.target.value })}
              placeholder="Type"
              style={{ width: 70, flex: 'none' }}
            />
            <input
              className={styles.inputInline}
              value={l.title}
              onChange={e => update({ title: e.target.value })}
              placeholder="Title"
            />
            <input
              className={styles.inputInline}
              value={l.url}
              onChange={e => update({ url: e.target.value })}
              placeholder="URL"
            />
          </div>
        )}
      />
    </div>
  ) : (
    entity._links.map((l, i) => (
      <div key={i} className={styles.metaPropRow}>
        <span className={styles.metaPropLabel}>
          {l.type ? l.type.charAt(0).toUpperCase() + l.type.slice(1) : 'Link'}
        </span>
        <span className={styles.metaPropValue}>
          <a
            className={styles.propLink}
            href={l.url.startsWith('http') ? l.url : `https://${l.url}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <TbExternalLink size={11} /> {l.title ?? l.url}
          </a>
        </span>
      </div>
    ))
  );
