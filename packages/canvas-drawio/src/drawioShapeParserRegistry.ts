import { Box } from '@diagram-craft/geometry/box';
import {
  parseArrow,
  parseBlockArc,
  parseCloud,
  parseCube,
  parseCurlyBracket,
  parseCylinder,
  parseDelay,
  parseDocument,
  parseEllipse,
  parseHexagon,
  parseImage,
  parseLine,
  parseParallelogram,
  parsePartialRect,
  parseProcess,
  parseRect,
  parseRhombus,
  parseStep,
  parseTable,
  parseTableRow,
  parseTransparent,
  parseTriangle
} from './shapes/basicShapes';
import type { ElementMetadata, NodeProps } from '@diagram-craft/model/diagramProps';
import type { DiagramNode, NodeTexts } from '@diagram-craft/model/diagramNode';
import type { StyleManager } from './styleManager';
import type { WorkQueue } from './workQueue';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

export type ShapeParser = (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  layer: RegularLayer,
  queue: WorkQueue
) => Promise<DiagramNode>;

export const shapeParsers: Record<string, ShapeParser> = {
  'hexagon': parseHexagon,
  'step': parseStep,
  'cloud': parseCloud,
  'rect': parseRect,
  'transparent': parseTransparent,
  'partialRectangle': parsePartialRect,
  'delay': parseDelay,
  'rhombus': parseRhombus,
  'parallelogram': parseParallelogram,
  'cylinder': parseCylinder,
  'cylinder3': parseCylinder,
  'process': parseProcess,
  'curlyBracket': parseCurlyBracket,
  'mxgraph.basic.partConcEllipse': parseBlockArc,
  'triangle': parseTriangle,
  'mxgraph.arrows2.arrow': parseArrow,
  'image': parseImage,
  'cube': parseCube,
  'line': parseLine,
  'ellipse': parseEllipse,
  'table': parseTable,
  'tableRow': parseTableRow,
  'document': parseDocument
};

export const getParser = (shape: string | undefined): ShapeParser | undefined =>
  shapeParsers[shape as keyof ShapeParser] ??
  shapeParsers[shape?.split('.').slice(0, -1).join('.') as keyof ShapeParser];
