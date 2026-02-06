import { Accordion } from '@diagram-craft/app-components/Accordion';
import { PickerSearchPanel } from './PickerSearchPanel';
import { ObjectPickerPanel } from './ObjectPickerPanel';
import { useDiagram } from '../../../application';
import { UserState } from '../../../UserState';
import { useCallback, useState } from 'react';
import type {
  RegisteredStencilPackage,
  StencilRegistry
} from '@diagram-craft/model/elementDefinitionRegistry';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindow } from '../ToolWindow';
import { useRedraw } from '../../hooks/useRedraw';

const SEARCH_KEY = '__search';

const getStencils = (stencilRegistry: StencilRegistry) => {
  return stencilRegistry
    .getStencils()
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .filter(s => s.id !== 'default');
};

export const ShapesPickerTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const stencilRegistry = diagram.document.registry.stencils;

  const userState = UserState.get();
  const [open, setOpen] = useState([
    SEARCH_KEY,
    ...userState.stencils.filter(s => s.isOpen).map(s => s.id)
  ]);
  const [loaded, setLoaded] = useState(
    new Set(userState.stencils.filter(s => s.isOpen).map(s => s.id))
  );
  const [activeStencils, setActiveStencils] = useState<Array<RegisteredStencilPackage>>(
    getStencils(stencilRegistry)
  );

  for (const id of open) {
    if (id === SEARCH_KEY) continue;
    stencilRegistry.loadStencilPackage(id);
  }

  const setOpenStencils = useCallback(
    (ids: Array<string>) => {
      setOpen(ids);
      setLoaded(loaded.union(new Set(ids)));

      const existingStencils = userState.stencils;

      // First, ensure all existing stencils have the new state
      const newStencils = existingStencils.map(s => ({ ...s, isOpen: ids.includes(s.id) }));

      // Then add any missing stencils
      for (const id of ids) {
        if (!existingStencils.some(s => s.id === id)) {
          newStencils.push({ id, isOpen: true });
        }
      }

      userState.setStencils(newStencils);
    },
    [loaded, userState]
  );

  useEventListener(stencilRegistry, 'change', () => {
    setActiveStencils(getStencils(stencilRegistry));
    redraw();
  });

  return (
    <ToolWindow.TabContent>
      <Accordion.Root type="multiple" value={open} onValueChange={setOpenStencils}>
        <PickerSearchPanel />

        <ObjectPickerPanel
          id={'basic-shapes'}
          title={'Basic shapes'}
          stencilPackage={stencilRegistry.get('default')}
          isOpen={open.includes('basic-shapes')}
        />

        {activeStencils.map(group => (
          <ObjectPickerPanel
            key={group.id}
            id={group.id}
            title={group.name}
            stencilPackage={group}
            isOpen={open.includes(group.id)}
          />
        ))}
      </Accordion.Root>
    </ToolWindow.TabContent>
  );
};
