import { TbChartLine } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { DiagramEmbed } from './DiagramEmbed';
import {
  DIAGRAM_EMBED_TYPE,
  DiagramEmbedEditable,
  diagramEmbedMdxRule
} from './DiagramEmbedEditable';
import type { DiagramEmbedSlateElement } from './types';

export const diagramEmbedSpec = defineMdxComponent<
  DiagramEmbedSlateElement,
  { id: string; caption?: string },
  'block'
>({
  component: DiagramEmbed,
  mode: 'block',
  allowedProps: ['id', 'caption'],
  editorSpec: {
    editableComponent: DiagramEmbedEditable,
    nodeOptions: { isVoid: true },
    mdxRule: diagramEmbedMdxRule,
    slashCommand: {
      key: 'diagram-embed',
      label: 'Diagram Embed',
      description: 'Embed a read-only diagram preview',
      icon: <TbChartLine size={14} />,
      keywords: ['diagram', 'embed', 'preview', 'svg', 'flow'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: DIAGRAM_EMBED_TYPE,
          fileId: '',
          caption: '',
          children: [{ text: '' }]
        });
      }
    }
  }
});
