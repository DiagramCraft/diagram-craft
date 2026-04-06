import type { ActionContext } from '@diagram-craft/canvas/action';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { SVG_EXPORT_MARGIN, prepareSvgForExport } from './actions/exportAction';
import type { FileLoader } from './loaders';

const DC_NS = 'https://github.com/DiagramCraft/diagram-craft/ns';

export const generateDiagramCraftSvg = async (context: ActionContext): Promise<string> => {
  const { clonedSvg, bounds } = await prepareSvgForExport(context);

  clonedSvg.setAttribute('width', (bounds.w + 2 * SVG_EXPORT_MARGIN).toString());
  clonedSvg.setAttribute('height', (bounds.h + 2 * SVG_EXPORT_MARGIN).toString());

  // Serialize diagram document and embed as base64 in <metadata>
  const docJson = await serializeDiagramDocument(context.model.activeDocument);
  const encoded = new TextEncoder().encode(JSON.stringify(docJson));
  const base64Json = btoa(Array.from(encoded, b => String.fromCharCode(b)).join(''));

  const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
  const dc = document.createElementNS(DC_NS, 'diagramcraft');
  dc.textContent = base64Json;
  metadata.appendChild(dc);
  clonedSvg.insertBefore(metadata, clonedSvg.firstChild);

  return new XMLSerializer().serializeToString(clonedSvg);
};

export const fileLoaderDiagramCraftSvg: () => Promise<FileLoader> =
  async () => async (content, doc, diagramFactory) => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(content, 'image/svg+xml');
    const el = svgDoc.querySelector('metadata > diagramcraft');
    if (!el?.textContent) throw new Error('Not a valid .diagramCraft.svg file');
    const decoded = Uint8Array.from(atob(el.textContent.trim()), c => c.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(decoded));
    return deserializeDiagramDocument(json, doc, diagramFactory);
  };
