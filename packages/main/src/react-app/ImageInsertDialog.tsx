import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useEffect, useState } from 'react';
import styles from './ImageInsertDialog.module.css';
import { TbFile, TbFolder } from 'react-icons/tb';
import React from 'react';
import { Diagram } from '@diagram-craft/model/diagram';
import { Tabs } from '@diagram-craft/app-components/Tabs';

type DirEntry = {
  name: string;
  isDirectory: boolean;
};

const ImageInsertDialogBrowser = (props: Props) => {
  const [path, setPath] = useState<string[]>([]);
  const [list, setList] = useState<DirEntry[] | undefined>(undefined);

  useEffect(() => {
    const getData = async () => {
      const response = await fetch(`http://localhost:3000/api/fs/${path.join('/')}`);
      const data = await response.json();
      setList(data.entries);
    };
    getData();
  }, [path]);

  return (
    <div className={styles.cmpInsertImageDialog}>
      <div className={styles.cmpInsertImageDialogPath}>
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
        <div className={styles.cmpInsertImageDialogList}>
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
                        props.onInsert!(path.join('/') + '/' + entry.name);
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
  );
};

export const ImageInsertDialog = (props: Props) => {
  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel!}
      title={'Insert Image'}
      buttons={[{ label: 'Cancel', type: 'cancel', onClick: props.onCancel! }]}
    >
      <Tabs.Root defaultValue={'device'}>
        <Tabs.List>
          <Tabs.Trigger value={'device'}>From device</Tabs.Trigger>
          <Tabs.Trigger value={'server'}>From server</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value={'device'}>
          <label
            className={'cmp-button'}
            style={{ fontSize: '11px', justifyContent: 'left' }}
            htmlFor={'file-upload'}
          >
            Upload...
          </label>

          <input
            id={'file-upload'}
            type={'file'}
            style={{ display: 'none', width: 0 }}
            onChange={async e => {
              props.onInsert!(e.target.files![0]);
            }}
          />
        </Tabs.Content>
        <Tabs.Content value={'server'}>
          <ImageInsertDialogBrowser {...props} />
        </Tabs.Content>
      </Tabs.Root>
    </Dialog>
  );
};

type Props = {
  diagram: Diagram;
  open: boolean;
  onInsert?: (url: string | Blob) => void;
  onCancel?: () => void;
};
