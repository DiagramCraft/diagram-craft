import { Accordion } from '@diagram-craft/app-components/Accordion';
import { PickerSearchPanel } from './PickerSearchPanel';
import { ObjectPickerPanel } from './ObjectPickerPanel';
import { useDiagram } from '../../../application';
import { UserState } from '../../../UserState';
import { useCallback, useState } from 'react';
import type {
  RegisteredStencilPackage,
  StencilRegistry
} from '@diagram-craft/model/stencilRegistry';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindow } from '../ToolWindow';
import { useRedraw } from '../../hooks/useRedraw';
import { AppConfig } from '../../../appConfig';
import { StencilPackageDialog } from './StencilPackageDialog';

const SEARCH_KEY = '__search';

type VisibleStencilPackage = {
  id: string;
  name: string;
  stencilPackage: RegisteredStencilPackage;
};

const getVisibleStencilPackages = (
  stencilRegistry: StencilRegistry,
  configuredPackages: ReadonlyArray<{ id: string }>,
  activeIds: ReadonlyArray<string>
): Array<VisibleStencilPackage> => {
  const result: VisibleStencilPackage[] = [];

  for (const entry of configuredPackages) {
    if (!activeIds.includes(entry.id)) continue;

    try {
      // Keep the configured id as the UI identity, even when the loader registers
      // the package under a different runtime id and exposes it through an alias.
      const stencilPackage = stencilRegistry.get(entry.id) as RegisteredStencilPackage;
      result.push({
        id: entry.id,
        name: stencilPackage.name,
        stencilPackage
      });
    } catch {
      // Package may not be registered yet; skip until AppLoader preregistration lands.
    }
  }

  return result;
};

export const _test = {
  getVisibleStencilPackages
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
  const [pickerViewMode, setPickerViewMode] = useState(userState.stencilPickerViewMode);
  const [loaded, setLoaded] = useState(
    new Set(userState.stencils.filter(s => s.isOpen).map(s => s.id))
  );
  const [manageStencilsOpen, setManageStencilsOpen] = useState(false);
  const [activePackageIds, setActivePackageIds] = useState(
    diagram.document.props.activeStencilPackages.ids
  );
  const [activeStencils, setActiveStencils] = useState<Array<VisibleStencilPackage>>(
    getVisibleStencilPackages(
      stencilRegistry,
      AppConfig.get().stencils.registry,
      diagram.document.props.activeStencilPackages.ids
    )
  );

  for (const id of open) {
    if (id === SEARCH_KEY) continue;
    // Expansion is the signal to eagerly load package contents into the picker.
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
    setActiveStencils(
      getVisibleStencilPackages(stencilRegistry, AppConfig.get().stencils.registry, activePackageIds)
    );
    redraw();
  });

  useEventListener(diagram.document.root, 'remoteAfterTransaction', () => {
    // Active package selection is document-scoped CRDT data, so remote edits need
    // to rebuild the visible picker groups even though the accordion state stays local.
    const ids = diagram.document.props.activeStencilPackages.ids;
    setActivePackageIds(ids);
    setActiveStencils(
      getVisibleStencilPackages(stencilRegistry, AppConfig.get().stencils.registry, ids)
    );
    redraw();
  });

  const onSaveActivePackages = useCallback(
    (ids: string[]) => {
      diagram.document.props.activeStencilPackages.set(ids);
      setActivePackageIds(ids);
      setActiveStencils(
        getVisibleStencilPackages(stencilRegistry, AppConfig.get().stencils.registry, ids)
      );

      // Packages removed from the document should also disappear from the local
      // accordion expansion state, otherwise the UI keeps stale open sections around.
      const nextOpenIds = open.filter(id => id === SEARCH_KEY || ids.includes(id));
      if (nextOpenIds.length !== open.length) {
        setOpen(nextOpenIds);
      }

      const existingStencils = userState.stencils;
      userState.setStencils(
        existingStencils.map(stencil => ({
          ...stencil,
          isOpen: ids.includes(stencil.id) ? stencil.isOpen : false
        }))
      );
    },
    [diagram.document.props.activeStencilPackages, open, stencilRegistry, userState]
  );

  return (
    <ToolWindow.TabContent>
      <Accordion.Root type="multiple" value={open} onValueChange={setOpenStencils}>
        <PickerSearchPanel
          pickerViewMode={pickerViewMode}
          onPickerViewModeChange={mode => {
            setPickerViewMode(mode);
            userState.stencilPickerViewMode = mode;
          }}
          onManageStencils={() => setManageStencilsOpen(true)}
        />

        {activeStencils.map(group => (
          <ObjectPickerPanel
            key={group.id}
            id={group.id}
            title={group.name}
            stencilPackage={group.stencilPackage}
            isOpen={open.includes(group.id)}
            pickerViewMode={pickerViewMode}
          />
        ))}
      </Accordion.Root>
      <StencilPackageDialog
        open={manageStencilsOpen}
        onClose={() => setManageStencilsOpen(false)}
        packages={AppConfig.get().stencils.registry.map(pkg => ({ id: pkg.id, name: pkg.name }))}
        activePackageIds={activePackageIds}
        onSave={onSaveActivePackages}
      />
    </ToolWindow.TabContent>
  );
};
