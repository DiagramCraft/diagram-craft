import { Dialog } from '@diagram-craft/app-components/Dialog';
import React, { useEffect, useState } from 'react';
import styles from './FileDialog.module.css';
import { TbFile, TbFolder } from 'react-icons/tb';
import { DialogCommand } from '@diagram-craft/canvas/context';
import { EmptyObject } from '@diagram-craft/utils/types';
import { AppConfig } from '../appConfig';
import { TextInput } from '@diagram-craft/app-components/TextInput';

type DirEntry = {
  name: string;
  isDirectory: boolean;
};

export const FileDialog = (props: Props) => {
  const [path, setPath] = useState<string[]>([]);
  const [list, setList] = useState<DirEntry[] | undefined>(undefined);
  const [filename, setFilename] = useState<string>(props.defaultFilename ?? 'diagram.json');

  useEffect(() => {
    const getData = async () => {
      const response = await fetch(
        `${AppConfig.get().filesystem.endpoint}/api/fs/${path.join('/')}`
      );
      const data = await response.json();
      setList(data.entries);
    };
    getData();
  }, [path]);

  const mode = props.mode ?? 'open';
  const isValidFilename = filename.trim().length > 0 && !/[\/\\]/.test(filename);

  const handleSave = () => {
    if (!isValidFilename) return;
    const fullPath = path.length > 0 ? `${path.join('/')}/${filename}` : filename;
    props.onOk(fullPath);
  };

  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel!}
      title={mode === 'saveAs' ? 'Save As' : 'Open'}
      buttons={
        mode === 'saveAs'
          ? [
              {
                label: 'Save',
                type: 'default',
                onClick: handleSave
              },
              { label: 'Cancel', type: 'cancel', onClick: props.onCancel! }
            ]
          : [{ label: 'Cancel', type: 'cancel', onClick: props.onCancel! }]
      }
    >
      <div className={styles.cmpFileDialog}>
        <div className={styles.cmpFileDialogPath}>
          Path:{' '}
          <a href={'#'} onClick={() => setPath([])}>
            Home
          </a>
          {path.map((p, i) => (
            <React.Fragment key={`${i}__${p}`}>
              /
              <a
                href={'#'}
                key={p}
                onClick={() => {
                  setPath(path.slice(0, i + 1));
                }}
              >
                {p}
              </a>
            </React.Fragment>
          ))}
        </div>

        {list === undefined ? (
          <p>Loading...</p>
        ) : (
          <div className={styles.cmpFileDialogList}>
            <div>
              <ul>
                {list.map(entry => (
                  <li key={entry.name}>
                    {entry.isDirectory ? (
                      <a href={'#'} onClick={() => setPath(p => [...p, entry.name])}>
                        <TbFolder /> {entry.name}
                      </a>
                    ) : mode === 'saveAs' ? (
                      <a
                        href={'#'}
                        onClick={() => {
                          setFilename(entry.name);
                        }}
                      >
                        <TbFile /> {entry.name}
                      </a>
                    ) : (
                      <a
                        href={'#'}
                        onClick={() => {
                          if (props.onOk) {
                            props.onOk(`${path.join('/')}/${entry.name}`);
                          }
                        }}
                      >
                        <TbFile /> {entry.name}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {mode === 'saveAs' && (
          <div style={{ marginTop: '1rem' }}>
            <label>Filename:</label>
            <TextInput
              type={'text'}
              value={filename}
              onChange={value => setFilename(value ?? '')}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter' && isValidFilename) {
                  handleSave();
                }
              }}
              style={{ width: '100%', marginTop: '0.25rem' }}
            />
            {!isValidFilename && filename.length > 0 && (
              <p style={{ color: 'var(--danger-fg)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Filename cannot contain / or \ characters
              </p>
            )}
          </div>
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
  defaultFilename?: string
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
