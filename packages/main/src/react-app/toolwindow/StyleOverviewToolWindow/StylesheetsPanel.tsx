import styles from './StyleOverviewToolWindow.module.css';
import { ToolWindowPanel } from '../ToolWindowPanel';
import type { Stylesheet, StylesheetType } from '@diagram-craft/model/diagramStyles';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { PickerCanvas } from '../../PickerCanvas';
import { PickerConfig } from '../PickerToolWindow/pickerConfig';
import { useApplication, useDiagram } from '../../../application';
import { useMemo, useState } from 'react';
import { TbLetterCase } from 'react-icons/tb';
import { Diagram } from '@diagram-craft/model/diagram';
import type { EdgeProps, NodeProps } from '@diagram-craft/model/diagramProps';
import { ContextMenu } from '@diagram-craft/app-components/ContextMenu';
import { Menu } from '@diagram-craft/app-components/Menu';
import { StringInputDialogCommand } from '@diagram-craft/canvas-app/dialogs';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  ElementStylesheetDialog,
  STYLESHEET_EDITORS
} from '../ObjectToolWindow/ElementStylesheetDialog';
import { type DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { createPreview } from './stylesPanelUtils';

type StylesheetsPanelProps = {
  stylesheets: Array<Stylesheet<'node'> | Stylesheet<'edge'> | Stylesheet<'text'>>;
};

type StylesheetGroup = {
  type: StylesheetType;
  stylesheets: Array<Stylesheet<'node'> | Stylesheet<'edge'> | Stylesheet<'text'>>;
};

type ElementStylesheetItemProps = {
  stylesheet: Stylesheet<'node'> | Stylesheet<'edge'>;
  diagram: Diagram;
  onModify: (stylesheet: Stylesheet<'node'> | Stylesheet<'edge'>) => void;
  onDelete: (stylesheet: Stylesheet<'node'> | Stylesheet<'edge'>) => void;
  onRename: (stylesheet: Stylesheet<'node'> | Stylesheet<'edge'>) => void;
  onApply: (stylesheet: Stylesheet<'node'> | Stylesheet<'edge'>) => void;
};
const ElementStylesheetItem = ({
  stylesheet,
  diagram,
  onModify,
  onDelete,
  onRename,
  onApply
}: ElementStylesheetItemProps) => {
  const previewDiagram = useMemo(
    () =>
      createPreview(stylesheet.props, stylesheet.type, 'rect', diagram.document.registry).diagram,
    [stylesheet, diagram]
  );

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        element={
          <div className={styles.styleItem} onClick={() => onApply(stylesheet)}>
            <div className={styles.stylePreview}>
              <PickerCanvas
                width={PickerConfig.size}
                height={PickerConfig.size}
                diagram={previewDiagram}
                showHover={false}
                onMouseDown={e => {
                  if (e.button === 1) {
                    onApply(stylesheet);
                  }
                }}
              />
            </div>
            <div className={styles.styleInfo}>
              <div className={styles.styleCount}>{stylesheet.name}</div>
            </div>
          </div>
        }
      />
      <ContextMenu.Menu>
        <Menu.Item onClick={() => onModify(stylesheet)}>Modify</Menu.Item>
        <Menu.Item onClick={() => onDelete(stylesheet)}>Delete</Menu.Item>
        <Menu.Item onClick={() => onRename(stylesheet)}>Rename</Menu.Item>
      </ContextMenu.Menu>
    </ContextMenu.Root>
  );
};

type TextStylesheetProps = {
  stylesheet: Stylesheet<'text'>;
  onModify: (stylesheet: Stylesheet<'text'>) => void;
  onDelete: (stylesheet: Stylesheet<'text'>) => void;
  onRename: (stylesheet: Stylesheet<'text'>) => void;
  onApply: (stylesheet: Stylesheet<'text'>) => void;
};
const TextStylesheetItem = ({
  stylesheet,
  onModify,
  onDelete,
  onRename,
  onApply
}: TextStylesheetProps) => {
  const textProps = (stylesheet.props as NodeProps).text;

  const fontStyle = {
    fontFamily: textProps?.font ?? 'Arial',
    fontSize: `${Math.min(textProps?.fontSize ?? 12, 14)}px`,
    fontWeight: textProps?.bold ? 'bold' : 'normal',
    fontStyle: textProps?.italic ? 'italic' : 'normal'
  };

  const metaParts = [
    `${textProps?.fontSize ?? 12}px`,
    textProps?.bold && 'Bold',
    textProps?.italic && 'Italic',
    textProps?.color
  ].filter(Boolean);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        element={
          <div className={styles.fontItem} onClick={() => onApply(stylesheet)}>
            <div className={styles.fontIcon}>
              <TbLetterCase size={18} />
            </div>
            <div className={styles.fontDetails}>
              <div className={styles.fontPreview} style={fontStyle}>
                {stylesheet.name}
              </div>
              <div className={styles.fontCount}>{metaParts.join(', ')}</div>
            </div>
          </div>
        }
      />
      <ContextMenu.Menu>
        <Menu.Item onClick={() => onModify(stylesheet)}>Modify</Menu.Item>
        <Menu.Item onClick={() => onDelete(stylesheet)}>Delete</Menu.Item>
        <Menu.Item onClick={() => onRename(stylesheet)}>Rename</Menu.Item>
      </ContextMenu.Menu>
    </ContextMenu.Root>
  );
};

const typeLabels = {
  node: 'Node Styles',
  edge: 'Edge Styles',
  text: 'Text Styles'
};

type AnyStylesheet = Stylesheet<'text'> | Stylesheet<'node'> | Stylesheet<'edge'>;

export const StylesheetsPanel = ({ stylesheets }: StylesheetsPanelProps) => {
  const diagram = useDiagram();
  const application = useApplication();

  const [dialogProps, setDialogProps] = useState<
    undefined | { props: NodeProps | EdgeProps; style: AnyStylesheet }
  >(undefined);

  const handleModify = (stylesheet: AnyStylesheet) => {
    setDialogProps({ props: stylesheet.props ?? {}, style: stylesheet });
  };

  const handleDelete = (stylesheet: AnyStylesheet) => {
    application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Confirm delete',
          message: 'Are you sure you want to delete this style?',
          okLabel: 'Yes',
          okType: 'danger',
          cancelLabel: 'No'
        },
        () => {
          UnitOfWork.executeWithUndo(diagram, 'Delete style', uow => {
            diagram.document.styles.deleteStylesheet(stylesheet.id, uow);
          });
        }
      )
    );
  };

  const handleRename = (stylesheet: AnyStylesheet) => {
    application.ui.showDialog(
      new StringInputDialogCommand(
        {
          label: 'Name',
          title: 'Rename style',
          description: 'Enter a new name for the style.',
          saveButtonLabel: 'Rename',
          value: stylesheet.name
        },
        v => {
          UnitOfWork.executeWithUndo(diagram, 'Rename style', uow => stylesheet.setName(v, uow));
        }
      )
    );
  };

  const handleApplyStylesheet = (stylesheet: AnyStylesheet) => {
    const selectedElements = diagram.selection.elements;
    if (selectedElements.length === 0) return;

    let elementsToApply: DiagramElement[];
    if (stylesheet.type === 'text') {
      elementsToApply = selectedElements.filter(isNode);
    } else if (stylesheet.type === 'node') {
      elementsToApply = selectedElements.filter(isNode);
    } else {
      elementsToApply = selectedElements.filter(el => !isNode(el));
    }

    if (elementsToApply.length === 0) return;

    UnitOfWork.executeWithUndo(diagram, 'Apply stylesheet', uow => {
      for (const element of elementsToApply) {
        diagram.document.styles.setStylesheet(element, stylesheet.id, uow, true);
      }
    });
  };

  const groups = useMemo(() => {
    const groupMap = new Map<string, StylesheetGroup>();

    const typeOrder = { node: 1, text: 2, edge: 3 };

    for (const stylesheet of stylesheets) {
      const type = stylesheet.type;
      if (!groupMap.has(type)) {
        groupMap.set(type, { type, stylesheets: [] });
      }
      groupMap.get(type)!.stylesheets.push(stylesheet);
    }

    // Sort stylesheets within each group alphabetically
    for (const group of groupMap.values()) {
      group.stylesheets.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Convert to array and sort by type order
    return Array.from(groupMap.values()).sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
  }, [stylesheets]);

  const openItems = useMemo(() => groups.map(g => g.type), [groups]);

  return (
    <>
      <ToolWindowPanel mode={'headless-no-padding'} id={'stylesheets-list'} title={'Stylesheets'}>
        {groups.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--base-fg-dim)' }}>
            No stylesheets found
          </div>
        ) : (
          <Accordion.Root type={'multiple'} value={openItems}>
            {groups.map(group => {
              return (
                <Accordion.Item key={group.type} value={group.type}>
                  <Accordion.ItemHeader>
                    <div className={styles.stylesheetName}>
                      <span>{typeLabels[group.type]}</span>
                      <span style={{ fontSize: '0.625rem', opacity: 0.7, marginLeft: '0.25rem' }}>
                        ({group.stylesheets.length})
                      </span>
                    </div>
                  </Accordion.ItemHeader>
                  <Accordion.ItemContent>
                    {group.type === 'text' ? (
                      <div className={styles.fontList}>
                        {group.stylesheets.map(stylesheet => (
                          <TextStylesheetItem
                            key={stylesheet.id}
                            stylesheet={stylesheet as Stylesheet<'text'>}
                            onModify={handleModify}
                            onDelete={handleDelete}
                            onRename={handleRename}
                            onApply={handleApplyStylesheet}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className={styles.styleList}>
                        {group.stylesheets.map(stylesheet => (
                          <ElementStylesheetItem
                            key={stylesheet.id}
                            stylesheet={stylesheet as Stylesheet<'node'> | Stylesheet<'edge'>}
                            diagram={diagram}
                            onModify={handleModify}
                            onDelete={handleDelete}
                            onRename={handleRename}
                            onApply={handleApplyStylesheet}
                          />
                        ))}
                      </div>
                    )}
                  </Accordion.ItemContent>
                </Accordion.Item>
              );
            })}
          </Accordion.Root>
        )}
      </ToolWindowPanel>
      {dialogProps && (
        <ElementStylesheetDialog
          open={!!dialogProps}
          props={dialogProps.props}
          type={dialogProps.style.type}
          onClose={() => setDialogProps(undefined)}
          onSave={e => {
            const style = dialogProps.style;

            const stylesheet = diagram.document.styles.get(style.id);
            if (stylesheet) {
              UnitOfWork.executeWithUndo(diagram, 'Modify style', uow =>
                stylesheet.setProps(e, uow)
              );
            }

            setDialogProps(undefined);
          }}
          editors={STYLESHEET_EDITORS[dialogProps.style.type]}
        />
      )}
    </>
  );
};
