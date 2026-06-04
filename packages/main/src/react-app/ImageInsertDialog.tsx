import { Dialog } from '@diagram-craft/app-components/Dialog';
import React, { useEffect, useState } from 'react';
import styles from './ImageInsertDialog.module.css';
import {
  TbChevronRight,
  TbCornerLeftUp,
  TbFileTypePng,
  TbFolder,
  TbFolderSearch,
  TbHome,
  TbPhoto
} from 'react-icons/tb';
import { ModeSwitcher } from '@diagram-craft/app-components/ModeSwitcher';
import { DialogCommand } from '@diagram-craft/canvas/context';
import { EmptyObject } from '@diagram-craft/utils/types';
import { AppConfig } from '../appConfig';
import buttonStyles from '@diagram-craft/app-components/Button.module.css';

type DirEntry = {
  name: string;
  isDirectory: boolean;
  size?: number;
};

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg']);

const isImageFile = (name: string) =>
  IMAGE_EXTS.has(name.split('.').pop()?.toLowerCase() ?? '');

const MODES = [
  { value: 'device', label: 'From device' },
  { value: 'server', label: 'From server' }
] as const;

type Mode = (typeof MODES)[number]['value'];

export const ImageInsertDialog = (props: Props) => {
  const [mode, setMode] = useState<Mode>('device');
  const [path, setPath] = useState<string[]>([]);
  const [list, setList] = useState<DirEntry[] | undefined>(undefined);
  const [selected, setSelected] = useState<DirEntry | null>(null);

  useEffect(() => {
    if (mode !== 'server') return;
    const controller = new AbortController();
    setList(undefined);
    setSelected(null);
    const getData = async () => {
      const response = await fetch(
        `${AppConfig.get().filesystem.endpoint}/api/fs/${path.join('/')}`,
        { signal: controller.signal }
      );
      const data = await response.json();
      setList(data.entries as DirEntry[]);
    };
    getData();
    return () => controller.abort();
  }, [path, mode]);

  useEffect(() => {
    if (props.open) {
      setPath([]);
      setSelected(null);
      setList(undefined);
    }
  }, [props.open]);

  const navigateInto = (entry: DirEntry) => {
    setPath(p => [...p, entry.name]);
    setSelected(null);
  };

  const navigateTo = (index: number) => {
    setPath(p => p.slice(0, index));
    setSelected(null);
  };

  const handleInsert = () => {
    if (!selected || selected.isDirectory) return;
    const fullPath = [...path, selected.name].join('/');
    props.onOk(fullPath);
  };

  const filteredList = list?.filter(e => e.isDirectory || isImageFile(e.name)) ?? [];

  const footerLeft = mode === 'server' ? (
    <span className={styles.eFooterMeta}>
      {selected && !selected.isDirectory ? (
        <><strong>{selected.name}</strong>{' · '}Image</>
      ) : (
        'Nothing selected'
      )}
    </span>
  ) : undefined;

  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel!}
      title="Insert Image"
      width={560}
      footerLeft={footerLeft}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: props.onCancel! },
        ...(mode === 'server'
          ? [{
              label: 'Insert',
              type: 'default' as const,
              disabled: !selected || selected.isDirectory,
              onClick: handleInsert
            }]
          : [])
      ]}
    >
      <div className={styles.icInsertImageDialog}>
      <div className={styles.eModeWrap}>
        <ModeSwitcher modes={MODES} value={mode} onChange={m => { setMode(m); setSelected(null); }} />
      </div>

      {mode === 'device' && (
        <>
          <label
            className={buttonStyles.cButton}
            style={{ fontSize: '11px', justifyContent: 'left' }}
            htmlFor="file-upload"
          >
            Upload...
          </label>
          <input
            id="file-upload"
            type="file"
            style={{ display: 'none', width: 0 }}
            onChange={async e => { props.onOk(e.target.files![0]!); }}
          />
        </>
      )}

      {mode === 'server' && (
        <>
          {/* Toolbar */}
          <div className={styles.eToolbar}>
            <button
              className={styles.eUpBtn}
              disabled={path.length === 0}
              onClick={() => navigateTo(path.length - 1)}
              title="Up one level"
            >
              <TbCornerLeftUp size={15} />
            </button>

            <nav className={styles.eBreadcrumb} aria-label="Path">
              <span className={styles.eCrumbLabel}>Path:</span>
              <button
                className={styles.eCrumb}
                data-current={path.length === 0 ? 'true' : undefined}
                onClick={path.length > 0 ? () => navigateTo(0) : undefined}
                disabled={path.length === 0}
              >
                <TbHome size={13} />
                <span>Home</span>
              </button>
              {path.map((segment, i) => (
                <React.Fragment key={`${i}__${segment}`}>
                  <span className={styles.eCrumbSep}><TbChevronRight size={13} /></span>
                  <button
                    className={styles.eCrumb}
                    data-current={i === path.length - 1 ? 'true' : undefined}
                    onClick={i < path.length - 1 ? () => navigateTo(i + 1) : undefined}
                    disabled={i === path.length - 1}
                  >
                    <span>{segment}</span>
                  </button>
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* File list */}
          <div className={styles.eListWrap}>
            <div className={styles.eList}>
              {list === undefined ? (
                <div className={styles.eEmpty}><p>Loading…</p></div>
              ) : filteredList.length === 0 ? (
                <div className={styles.eEmpty}>
                  <TbFolderSearch size={28} />
                  <p>No images in this folder.</p>
                </div>
              ) : (
                filteredList.map(entry => (
                  <button
                    key={entry.name}
                    role="option"
                    aria-selected={selected === entry}
                    className={styles.eRow}
                    data-selected={selected === entry ? 'true' : undefined}
                    onClick={() => setSelected(entry)}
                    onDoubleClick={() => {
                      if (entry.isDirectory) navigateInto(entry);
                      else {
                        const fullPath = [...path, entry.name].join('/');
                        props.onOk(fullPath);
                      }
                    }}
                  >
                    {entry.isDirectory ? (
                      <TbFolder size={15} />
                    ) : entry.name.toLowerCase().endsWith('.png') ? (
                      <TbFileTypePng size={15} />
                    ) : (
                      <TbPhoto size={15} />
                    )}
                    <span className={styles.eNameText}>{entry.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
      </div>
    </Dialog>
  );
};

ImageInsertDialog.create = (
  onOk: Props['onOk'],
  onCancel: Props['onCancel'] = () => {}
): DialogCommand<EmptyObject, string | Blob> => {
  return {
    id: 'imageInsert',
    props: {},
    onOk: onOk,
    onCancel: onCancel
  };
};

type Props = {
  open: boolean;
  onOk: (url: string | Blob) => void;
  onCancel?: () => void;
};
