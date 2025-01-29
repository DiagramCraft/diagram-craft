import * as Tabs from '@radix-ui/react-tabs';
import { useRedraw } from './hooks/useRedraw';
import { useEventListener } from './hooks/useEventListener';
import { TbFiles, TbPlus } from 'react-icons/tb';
import { Diagram } from '@diagram-craft/model/diagram';
import { RegularLayer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { newid } from '@diagram-craft/utils/id';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from './components/ActionContextMenuItem';
import { ReactNode } from 'react';

const DocumentsContextMenu = (props: DocumentsContextMenuProps) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild={true}>{props.children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="cmp-context-menu">
          <ActionContextMenuItem action={'EDGE_FLIP'}>Rename...</ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'}>Add</ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'}>Add subpage</ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'}>Delete</ActionContextMenuItem>
          <ContextMenu.Separator className="cmp-context-menu__separator" />
          <ActionContextMenuItem action={'EDGE_FLIP'}>Sheet 1.1</ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'}>Sheet 1.2</ActionContextMenuItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

type DocumentsContextMenuProps = {
  documentId: string;
  children: ReactNode;
};

export const DocumentTabs = (props: Props) => {
  const redraw = useRedraw();
  useEventListener(props.document, 'diagramremoved', redraw);
  useEventListener(props.document, 'diagramchanged', redraw);
  useEventListener(props.document, 'diagramadded', redraw);

  const selection = props.document.getById(props.value)?.id;

  return (
    <div className={'cmp-document-tabs'}>
      <Tabs.Root value={selection} onValueChange={props.onValueChange}>
        <Tabs.List className="cmp-document-tabs__tabs" aria-label="Diagrams in document">
          {props.document.topLevelDiagrams.map(d => (
            <Tabs.Trigger
              key={d.id}
              className="cmp-document-tabs__tab-trigger util-vcenter"
              value={d.id}
              id={`tab-${d.id}`}
            >
              <DocumentsContextMenu documentId={d.id}>
                <div>
                  {d.name}

                  {selection === d.id && selection !== props.value && (
                    <span>&nbsp;&gt;&nbsp;{props.document.getById(props.value)!.name}</span>
                  )}

                  {d.diagrams.length > 0 && (
                    <div style={{ marginLeft: '0.35rem', marginTop: '0.1rem' }}>
                      <TbFiles />
                    </div>
                  )}
                </div>
              </DocumentsContextMenu>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>
      <button
        className={'cmp-document-tabs__add'}
        onClick={() => {
          const id = newid();

          // TODO: Add undo here

          const diagram = new Diagram(
            id,
            'Sheet ' + (props.document.topLevelDiagrams.length + 1).toString(),
            props.document
          );
          diagram.layers.add(
            new RegularLayer('default', 'Default', [], diagram),
            UnitOfWork.immediate(diagram)
          );

          props.document.addDiagram(diagram);
          props.onValueChange(id);
        }}
      >
        <TbPlus />
      </button>
    </div>
  );
};

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  document: DiagramDocument;
};
