import { ToolWindow } from '../ToolWindow';
import { ToolWindowPanel } from '../ToolWindowPanel';
import styles from './TextToolWindow.module.css';
import { useDiagram } from '../../../application';
import { type DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import type { NodePropsForEditing } from '@diagram-craft/model/diagramNode';
import type { EdgePropsForEditing } from '@diagram-craft/model/diagramEdge';
import { assertRegularLayer, isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { AnchorEndpoint, ConnectedEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { useEventListener } from '../../hooks/useEventListener';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { assert } from '@diagram-craft/utils/assert';
import { Button } from '@diagram-craft/app-components/Button';
import { TbCheck, TbRestore } from 'react-icons/tb';
import { parse, type ParsedElement } from './parser';
import type { Diagram } from '@diagram-craft/model/diagram';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import {
  ElementAddUndoableAction,
  ElementDeleteUndoableAction,
  SnapshotUndoableAction
} from '@diagram-craft/model/diagramUndoActions';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { deepMerge } from '@diagram-craft/utils/object';

const serializeMetadata = (data: ElementMetadata | undefined) => {
  if (!data) return undefined;
  if (data.name) return `name=${data.name}`;
  return undefined;
};

const serializeProps = (data: ElementProps | undefined) => {
  if (!data) return undefined;

  // biome-ignore lint/suspicious/noExplicitAny: this is a valid use of any
  const collect = (obj: any, prefix = '') => {
    const result: string[] = [];
    for (const key in obj) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        result.push(...collect(value, `${prefix}${key}.`));
      } else {
        result.push(`${prefix}${key}=${value}`);
      }
    }
    return result;
  };

  const res = collect(data);
  if (res.length === 0) return undefined;
  return res.join(';');
};

const addElement = (element: DiagramElement, lines: string[], indent = '') => {
  if (isNode(element)) {
    let node = indent;
    node += `${element.id}:`;
    node += ` ${element.nodeType}`;

    if (element.texts.text) {
      node += ` "${element.texts.text}"`;
    }

    const sublines: string[] = [];

    for (const child of element.children) {
      addElement(child, sublines, `${indent}  `);
    }

    const metadataCloned = element.metadataCloned;
    const propsCloned = element.storedPropsCloned;

    let style = metadataCloned.style;
    let textStyle = metadataCloned.textStyle;
    if (style === 'default' || style === 'default-text') style = undefined;
    if (textStyle === 'default-text-default') textStyle = undefined;

    if (style || textStyle) {
      sublines.push(
        `${indent}  stylesheet: ${[style ? `${style} ` : '', textStyle ? ` ${textStyle}` : ''].join('/')}`
      );
    }

    const propsS = serializeProps(propsCloned);
    if (propsS) {
      sublines.push(`${indent}  props: "${propsS}"`);
    }

    const metadataS = serializeMetadata(metadataCloned);
    if (metadataS) {
      sublines.push(`${indent}  metadata: "${metadataS}"`);
    }

    if (sublines.length > 0) {
      lines.push(`${node} {`);
      lines.push(...sublines);
      lines.push(`${indent}}`);
    } else {
      lines.push(`${node}`);
    }
  } else if (isEdge(element)) {
    let edge = indent;
    edge += `${element.id}: edge`;

    if (element.start.isConnected || element.end.isConnected) {
      if (element.start.isConnected) {
        edge += ` ${(element.start as ConnectedEndpoint).node.id}`;
      }
      edge += ' -> ';
      if (element.end.isConnected) {
        edge += `${(element.end as ConnectedEndpoint).node.id}`;
      }
    }

    if (element.labelNodes.length === 1) {
      edge += ` "${element.labelNodes[0]!.node().texts.text}"`;
    }

    const sublines: string[] = [];
    const propsCloned = element.storedPropsCloned;

    for (const child of element.children) {
      addElement(child, sublines, `${indent}  `);
    }

    const propsS = serializeProps(propsCloned);
    if (propsS) {
      sublines.push(`${indent}  props: "${propsS}"`);
    }

    if (sublines.length > 0) {
      lines.push(`${edge} {`);
      lines.push(...sublines);
      lines.push(`${indent}}`);
    } else {
      lines.push(`${edge}`);
    }
  }
};

const applySyntaxHighlighting = (lines: string[], errors: Array<string | undefined>) => {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const error = errors[i];

    let dest = line;
    dest = dest.replaceAll(/("[^"]+")/g, '<span class="syntax-string">$1</span>');
    dest = dest.replaceAll(/^(\s*props):/g, '<span class="syntax-props">$1</span>:');
    dest = dest.replaceAll(/^(\s*[^:]+):/g, '<span class="syntax-label">$1</span>:');
    dest = dest.replaceAll(/({|})/g, '<span class="syntax-bracket">$1</span>');

    if (error) {
      dest = `<span class="syntax-error">${dest}</span>`;
    }

    result.push(dest);
  }

  return result;
};

/**
 * Parse a props string like "fill.color=#ff0000;stroke.width=2" into a nested object
 */
const parsePropsString = (propsStr: string): Partial<NodeProps | EdgeProps> => {
  const result: Record<string, unknown> = {};

  for (const pair of propsStr.split(';')) {
    const [key, value] = pair.split('=');
    if (!key || value === undefined) continue;

    const parts = key.split('.');

    let current: Record<string, unknown> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastKey = parts[parts.length - 1]!;
    // Try to parse as number or boolean, otherwise keep as string
    if (value === 'true') {
      current[lastKey] = true;
    } else if (value === 'false') {
      current[lastKey] = false;
    } else if (!Number.isNaN(Number(value))) {
      current[lastKey] = Number(value);
    } else {
      current[lastKey] = value;
    }
  }

  return result as Partial<NodeProps | EdgeProps>;
};

/**
 * Parse metadata string like "name=value" into an object
 */
const parseMetadataString = (metadataStr: string): Partial<ElementMetadata> => {
  const result: Partial<ElementMetadata> = {};

  for (const pair of metadataStr.split(';')) {
    const [key, value] = pair.split('=');
    if (!key || value === undefined) continue;

    if (key === 'name') {
      result.name = value;
    }
  }

  return result;
};

/**
 * Recursively collect all element IDs from parsed elements
 */
const collectParsedElementIds = (elements: ParsedElement[], ids: Set<string>) => {
  for (const element of elements) {
    ids.add(element.id);
    if (element.children) {
      collectParsedElementIds(element.children, ids);
    }
  }
};

const updateDiagram = (diagram: Diagram, elements: ParsedElement[]) => {
  const layer = diagram.activeLayer;
  assertRegularLayer(layer);

  const uow = new UnitOfWork(diagram, true);

  // Collect all parsed element IDs
  const parsedIds = new Set<string>();
  collectParsedElementIds(elements, parsedIds);

  // Collect existing element IDs in the active layer
  const existingIds = new Set<string>();
  const existingElements = new Map<string, DiagramElement>();
  for (const element of layer.elements) {
    existingIds.add(element.id);
    existingElements.set(element.id, element);
  }

  // Track elements to be removed
  const elementsToRemove: DiagramElement[] = [];

  // Process removals (elements in diagram but not in parsed data)
  for (const id of existingIds) {
    if (!parsedIds.has(id)) {
      const element = existingElements.get(id)!;
      uow.snapshot(element);
      element.layer.removeElement(element, uow);
      elementsToRemove.push(element);
    }
  }

  // Process updates and additions
  const processElement = (parsedElement: ParsedElement): DiagramElement | undefined => {
    const existingElement = diagram.lookup(parsedElement.id);

    if (existingElement) {
      // Update existing element
      uow.snapshot(existingElement);

      if (parsedElement.type === 'node' && isNode(existingElement)) {
        // Update text
        if (parsedElement.name !== undefined) {
          existingElement.setText(parsedElement.name, uow);
        }

        // Update props
        if (parsedElement.props) {
          const parsedProps = parsePropsString(parsedElement.props) as Partial<NodeProps>;
          existingElement.updateProps(props => {
            deepMerge(props, parsedProps);
          }, uow);
        }

        // Update metadata
        if (parsedElement.metadata) {
          const parsedMetadata = parseMetadataString(parsedElement.metadata);
          existingElement.updateMetadata(metadata => {
            Object.assign(metadata, parsedMetadata);
          }, uow);
        }

        // Update stylesheets
        if (parsedElement.stylesheet) {
          existingElement.updateMetadata(metadata => {
            metadata.style = parsedElement.stylesheet!;
          }, uow);
        }
        if (parsedElement.textStylesheet) {
          existingElement.updateMetadata(metadata => {
            metadata.textStyle = parsedElement.textStylesheet!;
          }, uow);
        }

        // Process children
        if (parsedElement.children) {
          for (const child of parsedElement.children) {
            processElement(child);
          }
        }
      } else if (parsedElement.type === 'edge' && isEdge(existingElement)) {
        // Update edge props
        if (parsedElement.props) {
          const parsedProps = parsePropsString(parsedElement.props) as Partial<EdgeProps>;
          existingElement.updateProps(props => {
            deepMerge(props, parsedProps);
          }, uow);
        }

        // Update metadata
        if (parsedElement.metadata) {
          const parsedMetadata = parseMetadataString(parsedElement.metadata);
          existingElement.updateMetadata(metadata => {
            Object.assign(metadata, parsedMetadata);
          }, uow);
        }

        // Update stylesheet
        if (parsedElement.stylesheet) {
          existingElement.updateMetadata(metadata => {
            metadata.style = parsedElement.stylesheet!;
          }, uow);
        }

        // Update connections (from/to)
        if (parsedElement.from !== undefined || parsedElement.to !== undefined) {
          if (parsedElement.from) {
            const fromNode = diagram.lookup(parsedElement.from);
            if (fromNode && isNode(fromNode)) {
              existingElement.setStart(new AnchorEndpoint(fromNode, 'c'), uow);
            }
          }
          if (parsedElement.to) {
            const toNode = diagram.lookup(parsedElement.to);
            if (toNode && isNode(toNode)) {
              existingElement.setEnd(new AnchorEndpoint(toNode, 'c'), uow);
            }
          }
        }
      }

      uow.updateElement(existingElement);
      return existingElement;
    } else {
      // Add new element
      let newElement: DiagramElement | undefined;

      if (parsedElement.type === 'node') {
        // Create new node at diagram center
        const centerX = diagram.bounds.x + diagram.bounds.w / 2;
        const centerY = diagram.bounds.y + diagram.bounds.h / 2;
        const bounds = { x: centerX - 50, y: centerY - 50, w: 100, h: 100, r: 0 };

        const props: NodePropsForEditing = {};
        const metadata: ElementMetadata = {};

        // Parse and apply props
        if (parsedElement.props) {
          const parsedProps = parsePropsString(parsedElement.props);
          Object.assign(props, parsedProps);
        }

        // Parse and apply metadata
        if (parsedElement.metadata) {
          const parsedMetadata = parseMetadataString(parsedElement.metadata);
          Object.assign(metadata, parsedMetadata);
        }

        // Apply stylesheets
        if (parsedElement.stylesheet) {
          metadata.style = parsedElement.stylesheet;
        }
        if (parsedElement.textStylesheet) {
          metadata.textStyle = parsedElement.textStylesheet;
        }

        newElement = ElementFactory.node(
          parsedElement.id,
          parsedElement.shape,
          bounds,
          layer,
          props,
          metadata,
          { text: parsedElement.name ?? '' }
        );

        layer.addElement(newElement, uow);

        // Process children
        if (parsedElement.children) {
          for (const child of parsedElement.children) {
            processElement(child);
          }
        }
      } else if (parsedElement.type === 'edge') {
        // Create new edge
        const props: EdgePropsForEditing = {};
        const metadata: ElementMetadata = {};

        // Parse and apply props
        if (parsedElement.props) {
          const parsedProps = parsePropsString(parsedElement.props);
          Object.assign(props, parsedProps);
        }

        // Parse and apply metadata
        if (parsedElement.metadata) {
          const parsedMetadata = parseMetadataString(parsedElement.metadata);
          Object.assign(metadata, parsedMetadata);
        }

        // Apply stylesheet
        if (parsedElement.stylesheet) {
          metadata.style = parsedElement.stylesheet;
        }

        // Determine endpoints
        let start: FreeEndpoint | AnchorEndpoint;
        let end: FreeEndpoint | AnchorEndpoint;

        if (parsedElement.from) {
          const fromNode = diagram.lookup(parsedElement.from);
          start =
            fromNode && isNode(fromNode)
              ? new AnchorEndpoint(fromNode, 'c')
              : new FreeEndpoint({ x: 0, y: 0 });
        } else {
          start = new FreeEndpoint({ x: 100, y: 100 });
        }

        if (parsedElement.to) {
          const toNode = diagram.lookup(parsedElement.to);
          end =
            toNode && isNode(toNode)
              ? new AnchorEndpoint(toNode, 'c')
              : new FreeEndpoint({ x: 200, y: 200 });
        } else {
          end = new FreeEndpoint({ x: 200, y: 200 });
        }

        newElement = ElementFactory.edge(parsedElement.id, start, end, props, metadata, [], layer);

        layer.addElement(newElement, uow);
      }

      if (newElement) {
        uow.addElement(newElement);
      }

      return newElement;
    }
  };

  // Process all top-level elements
  for (const element of elements) {
    processElement(element);
  }

  // Commit the UnitOfWork
  const snapshots = uow.commit();

  // Update selection to remove any elements that were removed
  if (elementsToRemove.length > 0) {
    const removedIds = new Set(elementsToRemove.map(e => e.id));
    const currentSelection = diagram.selection.elements;
    const updatedSelection = currentSelection.filter(e => !removedIds.has(e.id));

    if (updatedSelection.length !== currentSelection.length) {
      diagram.selection.setElements(updatedSelection);
    }
  }

  // Create compound undoable action
  const compoundAction = new CompoundUndoableAction();

  // Add undoable action for removals
  if (elementsToRemove.length > 0) {
    compoundAction.addAction(
      new ElementDeleteUndoableAction(diagram, layer, elementsToRemove, false)
    );
  }

  // Add undoable actions for additions
  const addedElements = snapshots.onlyAdded().keys;
  if (addedElements.length > 0) {
    compoundAction.addAction(
      new ElementAddUndoableAction(
        addedElements.map(id => diagram.lookup(id)!),
        diagram,
        layer
      )
    );
  }

  // Add undoable action for updates (via snapshot)
  const updatedSnapshots = snapshots.onlyUpdated();
  if (updatedSnapshots.keys.length > 0) {
    compoundAction.addAction(new SnapshotUndoableAction('Update diagram', diagram, updatedSnapshots));
  }

  if (compoundAction.hasActions()) {
    diagram.undoManager.add(compoundAction);
  }
};

export const TextToolWindow = () => {
  const diagram = useDiagram();
  const [lines, setLines] = useState<string[]>([]);
  const [errors, setErrors] = useState<Array<string | undefined>>([]);
  const [dirty, setDirty] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; message: string } | null>(null);

  const codeElementRef = useRef<HTMLElement>(null);
  const preElementRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const parseTimer = useRef<ReturnType<typeof setTimeout>>();

  const parseText = useCallback((lines: string[]) => {
    const text = lines.join('\n');
    const result = parse(text);
    setErrors(result.errors);
  }, []);

  const updateLines = useCallback(() => {
    const layer = diagram.activeLayer;
    const newLines: string[] = [];
    if (isRegularLayer(layer)) {
      for (const element of layer.elements) {
        addElement(element, newLines);
        newLines.push('');
      }
    }
    setLines(newLines);
    setErrors([]);
    setDirty(false);
  }, [diagram]);

  useEffect(() => updateLines(), [updateLines]);

  useEventListener(diagram, 'diagramChange', updateLines);
  useEventListener(diagram.layers, 'layerStructureChange', updateLines);
  useEventListener(diagram, 'elementAdd', updateLines);
  useEventListener(diagram, 'elementChange', updateLines);
  useEventListener(diagram, 'elementRemove', updateLines);
  useEventListener(diagram, 'elementBatchChange', updateLines);

  const applyChanges = useCallback(() => {
    const text = lines.join('\n');
    const result = parse(text);
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }

    updateDiagram(diagram, result.elements);

    updateLines();
  }, [diagram, lines, updateLines]);

  const onChange = useCallback(
    (text: string) => {
      assert.present(codeElementRef.current);
      setDirty(true);
      const lines = text.split('\n');
      setLines(lines);

      if (parseTimer.current) {
        clearTimeout(parseTimer.current);
      }
      parseTimer.current = setTimeout(() => parseText(lines), 500);
    },
    [parseText]
  );

  const onKeydown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();

        const $el = e.target as HTMLTextAreaElement;
        const text = $el.value;

        const before = text.slice(0, $el.selectionStart);
        const after = text.slice($el.selectionEnd, $el.value.length);
        const pos = $el.selectionEnd + 1;
        $el.value = `${before}  ${after}`;
        $el.selectionStart = pos;
        $el.selectionEnd = pos;

        onChange($el.value);
      }
    },
    [onChange]
  );

  const onScroll = useCallback((source: HTMLElement) => {
    assert.present(preElementRef.current);
    preElementRef.current.scrollTop = source.scrollTop;
    preElementRef.current.scrollLeft = source.scrollLeft;
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const rect = textarea.getBoundingClientRect();

      // Calculate which line the mouse is over based on line height
      const padding = 10; // matches CSS: padding: 10px;
      const lineHeight = 15; // matches CSS: 11px / 15px monospace
      const scrollTop = textarea.scrollTop;
      const mouseY = e.clientY - rect.top - padding + scrollTop;
      const lineIndex = Math.floor(mouseY / lineHeight);

      // Check if there's an error on this line
      if (lineIndex >= 0 && lineIndex < errors.length && errors[lineIndex]) {
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          message: errors[lineIndex]!
        });
      } else {
        setTooltip(null);
      }
    },
    [errors]
  );

  const onMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <ToolWindow.Root id={'text'} defaultTab={'text'}>
      <ToolWindow.Tab
        id={'text'}
        title={'Text'}
        indicator={
          dirty ? (
            <div
              style={{
                backgroundColor: 'var(--highlight-reverse-bg)',
                borderRadius: '50%',
                width: '6px',
                height: '6px'
              }}
            />
          ) : null
        }
      >
        <ToolWindow.TabActions>
          <Button type={'icon-only'} disabled={!dirty} onClick={() => updateLines()}>
            <TbRestore />
          </Button>
          <Button type={'icon-only'} disabled={!dirty} onClick={() => applyChanges()}>
            <TbCheck />
          </Button>
        </ToolWindow.TabActions>
        <ToolWindow.TabContent>
          <ToolWindowPanel
            mode={'headless-no-padding'}
            id={'text'}
            title={'Text'}
            // @ts-ignore
            style={{ anchorName: '--content' }}
          >
            <div className={styles.textEditorContainer}>
              <textarea
                ref={textareaRef}
                spellCheck={false}
                onKeyDown={e => onKeydown(e)}
                onInput={e => {
                  onChange((e.target as HTMLTextAreaElement).value);
                  onScroll(e.target as HTMLElement);
                }}
                onScroll={e => onScroll(e.target as HTMLElement)}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                value={lines.join('\n')}
              />

              <pre className={styles.textEditor} ref={preElementRef}>
                <code
                  ref={codeElementRef}
                  dangerouslySetInnerHTML={{
                    __html: applySyntaxHighlighting(lines, errors).join('\n')
                  }}
                />
              </pre>

              {tooltip && (
                <div
                  className={styles.tooltip}
                  style={{
                    left: `${tooltip.x}px`,
                    top: `${tooltip.y + 20}px`
                  }}
                >
                  {tooltip.message}
                </div>
              )}
            </div>
          </ToolWindowPanel>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
