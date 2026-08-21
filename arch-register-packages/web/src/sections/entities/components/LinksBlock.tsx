import type { Dispatch, SetStateAction } from 'react';
import { TbExternalLink, TbPlus, TbX } from 'react-icons/tb';
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
      {editLinks.map((l, i) => (
        <div key={i} className={styles.linkRow}>
          <input
            className={styles.inputInline}
            value={l.type ?? ''}
            onChange={e =>
              setEditLinks(ls => ls.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))
            }
            placeholder="Type"
            style={{ width: 70, flex: 'none' }}
          />
          <input
            className={styles.inputInline}
            value={l.title}
            onChange={e =>
              setEditLinks(ls => ls.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
            }
            placeholder="Title"
          />
          <input
            className={styles.inputInline}
            value={l.url}
            onChange={e =>
              setEditLinks(ls => ls.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
            }
            placeholder="URL"
          />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setEditLinks(ls => ls.filter((_, j) => j !== i))}
          >
            <TbX size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.addLinkBtn}
        onClick={() => setEditLinks(ls => [...ls, { url: '', title: '', type: '' }])}
      >
        <TbPlus size={11} /> Add link
      </button>
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
