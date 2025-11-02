import { Dialog } from '@diagram-craft/app-components/Dialog';
import React, { useEffect, useState } from 'react';
import styles from './FileDialog.module.css';
import { TbFile, TbFolder } from 'react-icons/tb';
import { DialogCommand } from '@diagram-craft/canvas/context';
import { EmptyObject } from '@diagram-craft/utils/types';
import { AppConfig } from '../appConfig';

type DirEntry = {
  name: string;
  isDirectory: boolean;
};

export const FileDialog = (props: Props) => {
  const [path, setPath] = useState<string[]>([]);
  const [list, setList] = useState<DirEntry[] | undefined>(undefined);

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

  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel!}
      title={'Open'}
      buttons={[{ label: 'Cancel', type: 'cancel', onClick: props.onCancel! }]}
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

type Props = {
  open: boolean;
  onOk: (file: string) => void;
  onCancel?: () => void;
};
