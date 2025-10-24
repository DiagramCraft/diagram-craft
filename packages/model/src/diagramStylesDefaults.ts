import { StylesheetSnapshot } from './unitOfWork';
import { DefaultStyles } from './diagramDefaults';

export const DEFAULT_NODE_STYLES: Record<
  string,
  Omit<StylesheetSnapshot, 'id' | '_snapshotType'>
> = {
  [DefaultStyles.node.default]: {
    name: 'Default',
    props: {
      fill: {
        color: 'var(--canvas-bg2)'
      },
      stroke: {
        color: 'var(--canvas-fg)'
      }
    },
    type: 'node'
  },

  [DefaultStyles.node.text]: {
    type: 'node',
    name: 'Text',
    props: {
      fill: {
        enabled: false
      },
      stroke: {
        enabled: false
      }
    }
  }
};

export const DEFAULT_TEXT_STYLES: Record<
  string,
  Omit<StylesheetSnapshot, 'id' | '_snapshotType'>
> = {
  [DefaultStyles.text.default]: {
    type: 'text',
    name: 'Default',
    props: {
      text: {
        color: 'var(--canvas-fg)',
        fontSize: 10,
        font: 'sans-serif',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }
    }
  },
  h1: {
    type: 'text',
    name: 'H1',
    props: {
      text: {
        color: 'var(--canvas-fg)',
        fontSize: 20,
        bold: true,
        font: 'sans-serif',
        align: 'left',
        top: 6,
        left: 6,
        right: 6,
        bottom: 6
      }
    }
  }
};

export const DEFAULT_EDGE_STYLES: Record<
  string,
  Omit<StylesheetSnapshot, 'id' | '_snapshotType'>
> = {
  [DefaultStyles.edge.default]: {
    type: 'edge',
    name: 'Default',
    props: {
      stroke: {
        color: 'var(--canvas-fg)'
      },
      type: 'straight'
    }
  }
};
