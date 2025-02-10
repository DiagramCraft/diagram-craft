import { DiagramElement } from './diagramElement';

export const getExternalDataStatus = (
  element: DiagramElement,
  schemaId: string
): 'none' | 'linked' | 'unlinked' => {
  const item = element.metadata.data?.data?.find(item => item.schema === schemaId);
  if (!item) return 'none';
  if (item.type === 'external') return 'linked';
  return 'unlinked';
};
