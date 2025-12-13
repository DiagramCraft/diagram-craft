import { Tabs as BaseUITabs } from '@base-ui-components/react/tabs';
import { useRedraw } from './hooks/useRedraw';
import { useEventListener } from './hooks/useEventListener';
import { TbCheck, TbFiles, TbPlus } from 'react-icons/tb';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from './components/ActionContextMenuItem';
import React, { ReactNode } from 'react';
import { useApplication } from '../application';
import { Diagram } from '@diagram-craft/model/diagram';

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
            <ContextMenu.RadioItem
              className="cmp-context-menu__item"
              onSelect={() => {
                props.onChange(diagram.id);
              }}
              value={diagram.id}
            >
              <ContextMenu.ItemIndicator className={'cmp-context-menu__item-indicator'}>
                <TbCheck />
              </ContextMenu.ItemIndicator>
              <span style={{ width: `${props.level * 10}px`, display: 'inline-block' }} />
              {diagram.name}
            </ContextMenu.RadioItem>
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
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild={true}>{props.children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="cmp-context-menu">
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
              <ContextMenu.Separator className="cmp-context-menu__separator" />

              <ContextMenu.RadioGroup value={props.diagramId}>
                <ContextMenu.RadioItem
                  className="cmp-context-menu__item"
                  onSelect={() => change(props.rootId)}
                  value={props.rootId}
                >
                  <ContextMenu.ItemIndicator className={'cmp-context-menu__item-indicator'}>
                    <TbCheck />
                  </ContextMenu.ItemIndicator>
                  {diagram.name}
                </ContextMenu.RadioItem>

                <DiagramList level={1} list={diagram.diagrams} onChange={change} />
              </ContextMenu.RadioGroup>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

type DocumentsContextMenuProps = {
  diagramId: string;
  rootId: string;
  children: ReactNode;
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
              >
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
              </DocumentsContextMenu>
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
