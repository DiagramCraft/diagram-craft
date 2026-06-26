import type React from 'react';
import { TbChartLine } from 'react-icons/tb';
import type { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import type { MdxComponentSpec } from '../../types';
import { DiagramEmbed } from './DiagramEmbed';
import {
  DIAGRAM_EMBED_TYPE,
  DiagramEmbedEditable,
  diagramEmbedMdxRule
} from './DiagramEmbedEditable';

export const diagramEmbedSpec = {
  component: DiagramEmbed as unknown as React.ComponentType<Record<string, string>>,
  mode: 'block',
  allowedProps: ['id', 'caption'],
  editorSpec: {
    editableComponent: DiagramEmbedEditable as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    nodeOptions: { isVoid: true as const },
    mdxRule: diagramEmbedMdxRule,
    slashCommand: {
      key: 'diagram-embed',
      label: 'Diagram Embed',
      description: 'Embed a read-only diagram preview',
      icon: <TbChartLine size={14} />,
      keywords: ['diagram', 'embed', 'preview', 'svg', 'flow'],
      onSelect: (
        editor: ReturnType<typeof useEditorRef>,
        { insertOrReplaceBlock }: { insertOrReplaceBlock: (editor: ReturnType<typeof useEditorRef>, node: TElement) => void }
      ) => {
        insertOrReplaceBlock(editor, {
          type: DIAGRAM_EMBED_TYPE,
          fileId: '',
          caption: '',
          children: [{ text: '' }]
        });
      }
    }
  }
} satisfies MdxComponentSpec;
