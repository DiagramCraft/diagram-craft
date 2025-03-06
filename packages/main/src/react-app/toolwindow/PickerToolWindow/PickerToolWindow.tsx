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

const SEARCH_KEY = '__search';

export const PickerToolWindow = () => {
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
    <Accordion.Root type="multiple" value={open} onValueChange={setOpenStencils}>
      <Accordion.Item value={SEARCH_KEY}>
        <Accordion.ItemHeader>Search</Accordion.ItemHeader>
        <Accordion.ItemContent>
          <PickerSearch />
        </Accordion.ItemContent>
      </Accordion.Item>

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
  );
};
