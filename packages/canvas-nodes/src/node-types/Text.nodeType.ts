import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import type { TextHandler, TextHandlers } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      textNode?: {
        split?: string;
        columnWidths?: string;
      };
    }
  }
}

registerCustomNodeDefaults('textNode', { split: '', columnWidths: '' });

// Regex constants hoisted to avoid recompilation on each render call
const RE_BR = /<br\s*\/?>/gi;
const RE_DIV_OPEN = /<div[^>]*>/gi;
const RE_DIV_CLOSE = /<\/div>/gi;

const normalizeEditableLines = (text: string): string[] => {
  const startsWithDiv = text.trimStart().startsWith('<div');
  const normalized = text.replace(RE_BR, '\n').replace(RE_DIV_OPEN, '\n').replace(RE_DIV_CLOSE, '');

  return (startsWithDiv ? normalized.replace(/^\n/, '') : normalized).split('\n');
};

const splitWithDelimiter = (line: string, delimiter: string, numCols: number): string[] => {
  let remaining = line;
  const parts: string[] = [];
  for (let i = 0; i < numCols - 1; i++) {
    const idx = remaining.indexOf(delimiter);
    if (idx === -1) break;
    // Keep the delimiter as part of the first column
    parts.push(remaining.slice(0, idx + delimiter.length));
    remaining = remaining.slice(idx + delimiter.length);
  }
  parts.push(remaining);
  return parts;
};

const toColumnsHTML = (text: string, split: string, columnWidths: string): string => {
  const widths = columnWidths
    .split(',')
    .map(w => w.trim())
    .filter(Boolean);
  if (widths.length === 0) return text;

  const numCols = widths.length;
  const templateColumns = widths.join(' ');

  // Normalize line separators from contenteditable HTML:
  // - <div>...</div> wraps each line after the first
  // - <br> is used in plaintext-only mode
  const lines = normalizeEditableLines(text);

  const dest: string[] = [];
  dest.push(
    `<div style="display: grid; column-gap: 0.25rem; grid-template-columns: ${templateColumns};">`
  );
  for (const line of lines) {
    const parts = splitWithDelimiter(line, split, numCols);
    for (const part of parts) {
      dest.push(`<div>${part}</div>`);
    }
    for (let i = parts.length; i < numCols; i++) {
      dest.push('<div></div>');
    }
  }
  dest.push('</div>');
  return dest.join('');
};

export class TextNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('text', 'Text', TextComponent);
  }

  getCustomPropertyDefinitions(node: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(p => [
      p.text(node, 'Split', 'custom.textNode.split'),
      p.text(node, 'Column Widths', 'custom.textNode.columnWidths')
    ]);
  }

  getTextHandler(node: DiagramNode): TextHandlers {
    const split = node.renderProps.custom.textNode.split;
    const columnWidths = node.renderProps.custom.textNode.columnWidths;

    if (!split || !columnWidths) {
      return ShapeNodeDefinition.DEFAULT_TEXT_HANDLERS;
    }

    const handler: TextHandler = {
      storedToEdit: s => s,
      editToStored: s => s,
      storedToHTML: s => toColumnsHTML(s, split, columnWidths)
    };
    return { dialog: handler, inline: handler };
  }
}

class TextComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    shapeBuilder.boundaryPath(props.node.getDefinition().getBoundingPathBuilder(props.node).getPaths().all());
    shapeBuilder.text(
      this,
      '1',
      props.node.getText(),
      props.nodeProps.text,
      props.node.bounds,
      this.onTextSizeChange(props)
    );
  }
}
