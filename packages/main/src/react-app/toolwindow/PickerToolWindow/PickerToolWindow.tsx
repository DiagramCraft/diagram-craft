import { ObjectPicker } from './ObjectPicker';
import { useCallback, useState } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { unique } from '@diagram-craft/utils/array';
import { UserState } from '../../../UserState';
import { useDiagram } from '../../../application';
import { PickerSearch } from './PickerSearch';
import { PickerConfig } from './pickerConfig';
import * as Tabs from '@radix-ui/react-tabs';
import { $c } from '@diagram-craft/utils/classname';
import { DataToolWindow } from './DataToolWindow';

const SEARCH_KEY = '__search';

export const PickerToolWindow = () => {
  const [tab, setTab] = useState<string>('picker');
  const diagram = useDiagram();
  const stencilRegistry = diagram.document.nodeDefinitions.stencilRegistry;

  const userState = UserState.get();
  const [open, setOpen] = useState([
    SEARCH_KEY,
    ...userState.stencils.filter(s => s.isOpen).map(s => s.id)
  ]);
  const [loaded, setLoaded] = useState(userState.stencils.filter(s => s.isOpen).map(s => s.id));
  const redraw = useRedraw();

  const setOpenStencils = useCallback(
    (ids: Array<string>) => {
      setOpen(ids);
      setLoaded(unique([...loaded, ...ids]));

      // Keep all userState stencils toggling the isOpen state, then
      // add all missing ids
      const existingStencils = [...userState.stencils];
      const newStencils: Array<{ id: string; isOpen?: boolean }> = [];
      for (const s of existingStencils) {
        if (ids.includes(s.id)) {
          newStencils.push({ ...s, isOpen: true });
        } else {
          newStencils.push({ ...s, isOpen: false });
        }
      }
      for (const id of ids) {
        if (!existingStencils.some(s => s.id === id)) {
          newStencils.push({ id, isOpen: true });
        }
      }
      userState.setStencils(newStencils);
    },
    [loaded, userState]
  );

  useEventListener(stencilRegistry, 'change', redraw);

  return (
    <Tabs.Root className={'cmp-tool-tabs'} value={tab} onValueChange={e => setTab(e)}>
      <Tabs.List className={$c('cmp-tool-tabs__tabs', { hidden: false })}>
        <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'picker'}>
          Shapes
        </Tabs.Trigger>
        <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'recent'}>
          Recent
        </Tabs.Trigger>
        <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'model'}>
          Model
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value={'picker'}>
        <Accordion.Root type="multiple" value={open} onValueChange={setOpenStencils}>
          <div className={'cmp-panel__headless'}>
            <PickerSearch />
          </div>

          <Accordion.Item value="basic-shapes">
            <Accordion.ItemHeader>Basic shapes</Accordion.ItemHeader>
            <Accordion.ItemContent>
              <ObjectPicker
                size={PickerConfig.size}
                stencils={stencilRegistry.get('default')!.stencils}
              />
            </Accordion.ItemContent>
          </Accordion.Item>

          {stencilRegistry
            .getActiveStencils()
            .toSorted((a, b) => a.name.localeCompare(b.name))
            .filter(s => s.id !== 'default')
            .map(group => (
              <Accordion.Item key={group.id} value={group.id}>
                <Accordion.ItemHeader>{group.name}</Accordion.ItemHeader>
                <Accordion.ItemContent forceMount={true}>
                  {loaded.includes(group.id) && (
                    <ObjectPicker size={PickerConfig.size} stencils={group.stencils} />
                  )}
                </Accordion.ItemContent>
              </Accordion.Item>
            ))}
        </Accordion.Root>
      </Tabs.Content>

      <Tabs.Content value={'recent'}>
        <div style={{ padding: '10px' }}>
          <ObjectPicker
            size={PickerConfig.size}
            stencils={diagram.document.props.recentStencils.stencils.map(
              s => stencilRegistry.getStencil(s)!
            )}
          />
        </div>
      </Tabs.Content>

      <Tabs.Content value={'model'}>
        <DataToolWindow />
      </Tabs.Content>
    </Tabs.Root>
  );
};
