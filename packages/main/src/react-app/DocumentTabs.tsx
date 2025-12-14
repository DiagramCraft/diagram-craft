import { Tabs as BaseUITabs } from '@base-ui-components/react/tabs';
import { useRedraw } from './hooks/useRedraw';
import { useEventListener } from './hooks/useEventListener';
import { TbCheck, TbFiles, TbPlus } from 'react-icons/tb';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { ActionContextMenuItem } from './components/ActionContextMenuItem';
import React, { type ReactElement } from 'react';
import { useApplication } from '../application';
import { Diagram } from '@diagram-craft/model/diagram';
import { ContextMenu as BaseUIContextMenu } from '@base-ui-components/react/context-menu';

const DiagramList = (props: {
  list: readonly Diagram[];
  level: number;
  onChange: (id: string) => void;
}) => {
  return (
    <>
      {props.list.map(diagram => {
        return (
          <React.Fragment key={diagram.id}>
            <BaseUIContextMenu.RadioItem
              className="cmp-context-menu__item"
              onClick={() => {
                props.onChange(diagram.id);
              }}
              value={diagram.id}
            >
              <BaseUIContextMenu.RadioItemIndicator className={'cmp-context-menu__item-indicator'}>
                <TbCheck />
              </BaseUIContextMenu.RadioItemIndicator>
              <span style={{ width: `${props.level * 10}px`, display: 'inline-block' }} />
              {diagram.name}
            </BaseUIContextMenu.RadioItem>
            <DiagramList
              list={diagram.diagrams}
              level={props.level + 1}
              onChange={props.onChange}
            />
          </React.Fragment>
        );
      })}
    </>
  );
};

const DocumentsContextMenu = (props: DocumentsContextMenuProps) => {
  const application = useApplication();
  const diagram = application.model.activeDocument.byId(props.rootId)!;

  const change = (id: string) => {
    application.model.activeDiagram = application.model.activeDocument.byId(id)!;
  };

  return (
    <BaseUIContextMenu.Root>
      <BaseUIContextMenu.Trigger render={props.element} />
      <BaseUIContextMenu.Portal>
        <BaseUIContextMenu.Positioner>
          <BaseUIContextMenu.Popup className="cmp-context-menu">
            <ActionContextMenuItem action={'DIAGRAM_RENAME'} arg={{ diagramId: props.diagramId }}>
              Rename...
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'DIAGRAM_ADD'} arg={{}}>
              Add
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'DIAGRAM_ADD'} arg={{ parentId: props.diagramId }}>
              Add subpage
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'DIAGRAM_REMOVE'} arg={{ diagramId: props.diagramId }}>
              Delete
            </ActionContextMenuItem>
            {diagram.diagrams.length > 0 && (
              <>
                <BaseUIContextMenu.Separator className="cmp-context-menu__separator" />

                <BaseUIContextMenu.RadioGroup value={props.diagramId}>
                  <BaseUIContextMenu.RadioItem
                    className="cmp-context-menu__item"
                    onClick={() => change(props.rootId)}
                    value={props.rootId}
                  >
                    <BaseUIContextMenu.RadioItemIndicator
                      className={'cmp-context-menu__item-indicator'}
                    >
                      <TbCheck />
                    </BaseUIContextMenu.RadioItemIndicator>
                    {diagram.name}
                  </BaseUIContextMenu.RadioItem>

                  <DiagramList level={1} list={diagram.diagrams} onChange={change} />
                </BaseUIContextMenu.RadioGroup>
              </>
            )}
          </BaseUIContextMenu.Popup>
        </BaseUIContextMenu.Positioner>
      </BaseUIContextMenu.Portal>
    </BaseUIContextMenu.Root>
  );
};

type DocumentsContextMenuProps = {
  diagramId: string;
  rootId: string;
  element: ReactElement;
};

export const DocumentTabs = (props: Props) => {
  const application = useApplication();
  const redraw = useRedraw();
  useEventListener(props.document, 'diagramRemoved', redraw);
  useEventListener(props.document, 'diagramChanged', redraw);
  useEventListener(props.document, 'diagramAdded', redraw);

  // The selection can be different from the active diagram as the selection
  // is the "root" of the activeDiagram
  const path = application.model.activeDocument.getDiagramPath(application.model.activeDiagram);
  const selection = path[0]?.id;

  return (
    <div className={'cmp-document-tabs'}>
      <BaseUITabs.Root
        value={selection}
        onValueChange={d => {
          application.model.activeDiagram = props.document.byId(d)!;
        }}
      >
        <BaseUITabs.List className="cmp-document-tabs__tabs" aria-label="Diagrams in document">
          {props.document.diagrams.map(d => (
            <BaseUITabs.Tab
              key={d.id}
              className="cmp-document-tabs__tab-trigger util-vcenter"
              value={d.id}
              id={`tab-${d.id}`}
            >
              <DocumentsContextMenu
                rootId={d.id}
                diagramId={path[0] === d ? path.at(-1)!.id : d.id}
                element={
                  <div>
                    {d.name}

                    {path[0] === d &&
                      path.length > 1 &&
                      path.slice(1).map((e, k) => <span key={k}>&nbsp;&gt;&nbsp;{e.name}</span>)}

                    {d.diagrams.length > 0 && (
                      <div style={{ marginLeft: '0.35rem', marginTop: '0.1rem' }}>
                        <TbFiles />
                      </div>
                    )}
                  </div>
                }
              ></DocumentsContextMenu>
            </BaseUITabs.Tab>
          ))}
        </BaseUITabs.List>
      </BaseUITabs.Root>
      <button
        className={'cmp-document-tabs__add'}
        type="button"
        onClick={() => application.actions['DIAGRAM_ADD']?.execute({})}
      >
        <TbPlus />
      </button>
    </div>
  );
};

type Props = {
  document: DiagramDocument;
};
