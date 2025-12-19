import styles from './StylesPanel.module.css';
import { ToolWindowPanel } from '../ToolWindowPanel';
import type { Stylesheet, StylesheetType } from '@diagram-craft/model/diagramStyles';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { PickerCanvas } from '../../PickerCanvas';
import { PickerConfig } from '../PickerToolWindow/pickerConfig';
import { useDiagram } from '../../../application';
import { useMemo } from 'react';
import { TbLetterCase } from 'react-icons/tb';
import { Diagram } from '@diagram-craft/model/diagram';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { newid } from '@diagram-craft/utils/id';
import type { EdgeProps, NodeProps } from '@diagram-craft/model/diagramProps';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import { createThumbnailForNode, createThumbnailForEdge } from '@diagram-craft/canvas-app/diagramThumbnail';

type StylesheetsPanelProps = {
  stylesheets: Array<Stylesheet<'node'> | Stylesheet<'edge'> | Stylesheet<'text'>>;
};

type StylesheetGroup = {
  type: StylesheetType;
  stylesheets: Array<Stylesheet<'node'> | Stylesheet<'edge'> | Stylesheet<'text'>>;
};

const createPreviewDiagram = (
  stylesheet: Stylesheet<'node'> | Stylesheet<'edge'>,
  type: 'node' | 'edge',
  definitions: any
): Diagram => {
  if (type === 'edge') {
    const { diagram } = createThumbnailForEdge((_: Diagram, layer: RegularLayer) => {
      return ElementFactory.edge(
        newid(),
        new FreeEndpoint({ x: 5, y: 25 }),
        new FreeEndpoint({ x: 45, y: 25 }),
        stylesheet.props as Partial<EdgeProps>,
        {},
        [],
        layer
      );
    }, definitions);

    diagram.viewBox.dimensions = { w: 50, h: 50 };
    diagram.viewBox.offset = { x: 0, y: 0 };

    return diagram;
  } else {
    const { diagram } = createThumbnailForNode((_: Diagram, layer: RegularLayer) => {
      return ElementFactory.node(
        newid(),
        'rect',
        { x: 5, y: 5, w: 40, h: 40, r: 0 },
        layer,
        stylesheet.props as Partial<NodeProps>,
        {}
      );
    }, definitions);

    diagram.viewBox.dimensions = { w: 50, h: 50 };
    diagram.viewBox.offset = { x: 0, y: 0 };

    return diagram;
  }
};

const NodeEdgeStylesheetItem = ({ stylesheet, diagram }: { stylesheet: Stylesheet<'node'> | Stylesheet<'edge'>; diagram: Diagram }) => {
  const previewDiagram = useMemo(
    () => createPreviewDiagram(stylesheet, stylesheet.type, diagram.document.definitions),
    [stylesheet, diagram]
  );

  return (
    <div className={styles.styleItem}>
      <div className={styles.stylePreview}>
        <PickerCanvas
          width={PickerConfig.size}
          height={PickerConfig.size}
          diagram={previewDiagram}
          showHover={false}
        />
      </div>
      <div className={styles.styleInfo}>
        <div className={styles.styleCount}>{stylesheet.name}</div>
      </div>
    </div>
  );
};

const TextStylesheetItem = ({ stylesheet }: { stylesheet: Stylesheet<'text'> }) => {
  const textProps = (stylesheet.props as any).text;

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
    <div className={styles.fontItem}>
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
  );
};

const typeLabels = {
  node: 'Node Styles',
  edge: 'Edge Styles',
  text: 'Text Styles'
};

export const StylesheetsPanel = ({ stylesheets }: StylesheetsPanelProps) => {
  const diagram = useDiagram();

  const groups = useMemo(() => {
    const groupMap = new Map<string, StylesheetGroup>();

    const typeOrder = { node: 1, text: 2, edge: 3 };

    for (const stylesheet of stylesheets) {
      const type = stylesheet.type;
      if (!groupMap.has(type)) {
        groupMap.set(type, {
          type,
          stylesheets: []
        });
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
                        <TextStylesheetItem key={stylesheet.id} stylesheet={stylesheet as Stylesheet<'text'>} />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.styleList}>
                      {group.stylesheets.map(stylesheet => (
                        <NodeEdgeStylesheetItem
                          key={stylesheet.id}
                          stylesheet={stylesheet as Stylesheet<'node'> | Stylesheet<'edge'>}
                          diagram={diagram}
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
  );
};
