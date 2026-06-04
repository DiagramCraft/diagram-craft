import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import React, { useEffect, useMemo, useState } from 'react';
import styles from './FileDialog.module.css';
import {
  TbAlertTriangle,
  TbArrowDown,
  TbArrowUp,
  TbChevronRight,
  TbCornerLeftUp,
  TbDeviceFloppy,
  TbFileCode,
  TbFileVector,
  TbFolder,
  TbFolderPlus,
  TbFolderSearch,
  TbHome
} from 'react-icons/tb';
import { DialogCommand } from '@diagram-craft/canvas/context';
import { EmptyObject } from '@diagram-craft/utils/types';
import { AppConfig } from '../appConfig';
import { $t } from '@diagram-craft/utils/localize';

type DirEntry = {
  name: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: number;
};

type SortKey = 'name' | 'size' | 'modified';
type FileType = 'json' | 'svg';

const fmtSize = (bytes?: number): string => {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const fmtDate = (ms?: number): string => {
  if (ms == null) return '—';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const parseDefaultFilename = (name: string): { base: string; type: FileType } => {
  if (name.endsWith('.svg')) return { base: name.slice(0, -4), type: 'svg' };
  if (name.endsWith('.json')) return { base: name.slice(0, -5), type: 'json' };
  return { base: name, type: 'json' };
};

const sortEntries = (entries: DirEntry[], key: SortKey, dir: 1 | -1): DirEntry[] => {
  return [...entries].sort((a, b) => {
    const aDir = a.isDirectory ? 0 : 1;
    const bDir = b.isDirectory ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    let av: string | number;
    let bv: string | number;
    if (key === 'size') {
      av = a.size ?? -1;
      bv = b.size ?? -1;
    } else if (key === 'modified') {
      av = a.modifiedAt ?? -1;
      bv = b.modifiedAt ?? -1;
    } else {
      av = a.name.toLowerCase();
      bv = b.name.toLowerCase();
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
  });
};

export const FileDialog = (props: Props) => {
  const [path, setPath] = useState<string[]>([]);
  const [list, setList] = useState<DirEntry[] | undefined>(undefined);
  const [selected, setSelected] = useState<DirEntry | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [filter, setFilter] = useState('');
  const [filename, setFilename] = useState<string>(() => parseDefaultFilename(props.defaultFilename ?? '').base);
  const [fileType, setFileType] = useState<FileType>(() => parseDefaultFilename(props.defaultFilename ?? '').type);

  const mode = props.mode ?? 'open';

  useEffect(() => {
    const controller = new AbortController();
    const getData = async () => {
      setList(undefined);
      setSelected(null);
      const response = await fetch(
        `${AppConfig.get().filesystem.endpoint}/api/fs/${path.join('/')}`,
        { signal: controller.signal }
      );
      const data = await response.json();
      setList(data.entries as DirEntry[]);
    };
    getData();
    return () => controller.abort();
  }, [path]);

  useEffect(() => {
    if (props.open) {
      setPath([]);
      setSelected(null);
      setFilter('');
      setSortKey('name');
      setSortDir(1);
      const parsed = parseDefaultFilename(props.defaultFilename ?? '');
      setFilename(parsed.base);
      setFileType(parsed.type);
    }
  }, [props.open]);

  const sortedFiltered = useMemo(() => {
    if (!list) return [];
    const trimmed = filter.trim();
    const items = trimmed
      ? list.filter(e => e.name.toLowerCase().includes(trimmed.toLowerCase()))
      : list;
    return sortEntries(items, sortKey, sortDir);
  }, [list, filter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 1 : -1);
    }
  };

  const navigateInto = (entry: DirEntry) => {
    setPath(p => [...p, entry.name]);
    setFilter('');
    setSelected(null);
  };

  const navigateTo = (index: number) => {
    setPath(p => p.slice(0, index));
    setFilter('');
    setSelected(null);
  };

  const handleRowClick = (entry: DirEntry) => {
    setSelected(entry);
    if (mode === 'saveAs' && !entry.isDirectory) {
      const dot = entry.name.lastIndexOf('.');
      const base = dot > 0 ? entry.name.slice(0, dot) : entry.name;
      setFilename(base);
      if (entry.name.endsWith('.svg')) setFileType('svg');
      else setFileType('json');
    }
  };

  const handleRowDoubleClick = (entry: DirEntry) => {
    if (entry.isDirectory) {
      navigateInto(entry);
    } else if (mode === 'open') {
      doOpen(entry);
    }
  };

  const doOpen = (entry?: DirEntry) => {
    const target = entry ?? selected;
    if (!target || target.isDirectory) return;
    const fullPath = [...path, target.name].join('/');
    props.onOk(fullPath);
  };

  const isValidFilename = filename.trim().length > 0 && !/[/\\]/.test(filename);

  const currentFilename = `${filename.trim() || 'Untitled'}.${fileType}`;

  const hasConflict =
    mode === 'saveAs' &&
    isValidFilename &&
    !!list?.some(e => !e.isDirectory && e.name.toLowerCase() === currentFilename.toLowerCase());

  const handleSave = () => {
    if (!isValidFilename) return;
    const fullPath = path.length > 0 ? `${path.join('/')}/${currentFilename}` : currentFilename;
    props.onOk(fullPath);
  };

  const handleNewFolder = () => {
    if (!list) return;
    const existingNames = new Set(list.map(e => e.name.toLowerCase()));
    let name = 'untitled folder';
    let n = 2;
    while (existingNames.has(name.toLowerCase())) name = `untitled folder ${n++}`;
    const newEntry: DirEntry = { name, isDirectory: true };
    const newList = sortEntries([...list, newEntry], 'name', 1);
    setList(newList);
    setSortKey('name');
    setSortDir(1);
    setSelected(newEntry);
  };

  const breadcrumbPath = path.join(' / ');
  const currentPathDisplay = path.length > 0 ? `Home / ${breadcrumbPath}` : 'Home';

  const footerLeft =
    mode === 'open' ? (
      <span className={styles.eFooterMeta}>
        {selected && !selected.isDirectory ? (
          <>
            <strong>{selected.name}</strong>
            {' · '}
            {selected.name.endsWith('.svg') ? 'SVG file' : 'JSON file'}
            {' · '}
            {fmtSize(selected.size)}
          </>
        ) : (
          'Nothing selected'
        )}
      </span>
    ) : (
      <span className={styles.eFooterPath}>
        <TbDeviceFloppy size={13} />
        <span>{currentPathDisplay}</span>
      </span>
    );

  const openDisabled = mode === 'open' && (!selected || selected.isDirectory);

  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel!}
      title={mode === 'saveAs' ? $t('dialog.file.save_as', 'Save As') : $t('dialog.file.open', 'Open')}
      sub={
        mode === 'saveAs'
          ? 'Pick a destination folder and name your diagram. Click an existing file to reuse its name.'
          : 'Choose a diagram to open. Double-click a folder to browse into it.'
      }
      width={660}
      footerLeft={footerLeft}
      buttons={
        mode === 'saveAs'
          ? [
              { label: $t('common.cancel', 'Cancel'), type: 'cancel', onClick: props.onCancel! },
              {
                label: hasConflict ? 'Replace' : $t('common.save', 'Save'),
                type: 'default',
                disabled: !isValidFilename,
                onClick: handleSave
              }
            ]
          : [
              { label: $t('common.cancel', 'Cancel'), type: 'cancel', onClick: props.onCancel! },
              {
                label: 'Open',
                type: 'default',
                disabled: openDisabled,
                onClick: () => doOpen()
              }
            ]
      }
    >
      <div className={styles.icFileDialog}>
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

        {mode === 'open' ? (
          <TextInput
            variant="search"
            value={filter}
            onChange={v => { setFilter(v ?? ''); setSelected(null); }}
            onClear={() => { setFilter(''); setSelected(null); }}
            placeholder="Filter this folder"
            style={{ width: '190px', flexShrink: 0 }}
          />
        ) : (
          <button className={styles.eNewFolderBtn} onClick={handleNewFolder}>
            <TbFolderPlus size={13} />
            New folder
          </button>
        )}
      </div>

      {/* File list */}
      <div className={styles.eListWrap}>
        {/* Column header */}
        <div className={styles.eColHead}>
          <button
            className={styles.eColBtn}
            data-sorted={sortKey === 'name' ? 'true' : undefined}
            onClick={() => handleSort('name')}
          >
            Name {sortKey === 'name' ? (sortDir === 1 ? <TbArrowUp size={12} /> : <TbArrowDown size={12} />) : null}
          </button>
          <button
            className={styles.eColBtn}
            data-right="true"
            data-sorted={sortKey === 'size' ? 'true' : undefined}
            onClick={() => handleSort('size')}
          >
            Size {sortKey === 'size' ? (sortDir === 1 ? <TbArrowUp size={12} /> : <TbArrowDown size={12} />) : null}
          </button>
          <button
            className={styles.eColBtn}
            data-right="true"
            data-sorted={sortKey === 'modified' ? 'true' : undefined}
            onClick={() => handleSort('modified')}
          >
            Modified {sortKey === 'modified' ? (sortDir === 1 ? <TbArrowUp size={12} /> : <TbArrowDown size={12} />) : null}
          </button>
        </div>

        {/* Rows */}
        <div className={styles.eList}>
          {list === undefined ? (
            <div className={styles.eEmpty}>
              <p>Loading…</p>
            </div>
          ) : sortedFiltered.length === 0 ? (
            <div className={styles.eEmpty}>
              <TbFolderSearch size={28} />
              <p>{filter ? `No items match "${filter}".` : 'This folder is empty.'}</p>
            </div>
          ) : (
            sortedFiltered.map(entry => {
              const isSelected = selected === entry;
              const isFile = !entry.isDirectory;
              return (
                <button
                  key={entry.name}
                  role="option"
                  aria-selected={isSelected}
                  className={styles.eRow}
                  data-selected={isSelected ? 'true' : undefined}
                  data-dimmed={isFile && mode === 'saveAs' ? 'true' : undefined}
                  data-kind={entry.isDirectory ? 'dir' : entry.name.endsWith('.svg') ? 'svg' : 'json'}
                  onClick={() => handleRowClick(entry)}
                  onDoubleClick={() => handleRowDoubleClick(entry)}
                >
                  <span className={styles.eName}>
                    {entry.isDirectory ? (
                      <TbFolder size={16} />
                    ) : entry.name.endsWith('.svg') ? (
                      <TbFileVector size={16} />
                    ) : (
                      <TbFileCode size={16} />
                    )}
                    <span className={styles.eNameText}>{entry.name}</span>
                  </span>
                  <span className={styles.eCell}>{entry.isDirectory ? '—' : fmtSize(entry.size)}</span>
                  <span className={styles.eCell}>{fmtDate(entry.modifiedAt)}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Save As fields */}
      {mode === 'saveAs' && (
        <>
          <div className={styles.eSaveFields}>
            <div className={styles.eSaveField}>
              <label className={styles.eFieldLabel} htmlFor="fd-filename">
                {$t('dialog.file.filename', 'Filename')}
              </label>
              <TextInput
                id="fd-filename"
                value={filename}
                onChange={v => setFilename(v ?? '')}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && isValidFilename) handleSave();
                }}
                spellCheck={false}
                autoComplete="off"
                style={{ width: '100%' }}
              />
            </div>
            <div className={styles.eSaveField}>
              <label className={styles.eFieldLabel} htmlFor="fd-type">Save as type</label>
              <Select.Root value={fileType} onChange={v => setFileType((v ?? 'json') as FileType)}>
                <Select.Item value="json">Arch Register diagram (.json)</Select.Item>
                <Select.Item value="svg">Scalable Vector Graphic (.svg)</Select.Item>
              </Select.Root>
            </div>
          </div>

          {hasConflict && (
            <div className={styles.eWarn}>
              <TbAlertTriangle size={13} />
              <span>
                A file named <strong>{currentFilename}</strong> already exists here and will be overwritten.
              </span>
            </div>
          )}
        </>
      )}
      </div>
    </Dialog>
  );
};

FileDialog.create = (
  onOk: Props['onOk'],
  onCancel: Props['onCancel'] = () => {}
): DialogCommand<EmptyObject, string> => {
  return {
    id: 'fileOpen',
    props: {},
    onOk: onOk,
    onCancel: onCancel
  };
};

FileDialog.createSaveAs = (
  onOk: Props['onOk'],
  onCancel: Props['onCancel'] = () => {},
  defaultFilename: string
): DialogCommand<{ mode: 'saveAs'; defaultFilename?: string }, string> => {
  return {
    id: 'fileSaveAs',
    props: { mode: 'saveAs', defaultFilename },
    onOk: onOk,
    onCancel: onCancel
  };
};

type Props = {
  open: boolean;
  onOk: (file: string) => void;
  onCancel?: () => void;
  mode?: 'open' | 'saveAs';
  defaultFilename?: string;
};
