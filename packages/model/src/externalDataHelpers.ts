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

export const findEntryBySchema = (element: DiagramElement, schemaId: string) => {
  return element.metadata.data?.data?.find(s => s.schema === schemaId);
};

export const hasDataForSchema = (element: DiagramElement, schemaId: string) => {
  const entry = findEntryBySchema(element, schemaId);
  if (!entry?.data) return false;
  return Object.values(entry.data).some(value => value !== undefined && value !== '');
};
