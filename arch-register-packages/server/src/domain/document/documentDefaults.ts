import {
  ADR_DOCUMENT_TEMPLATE_NAME as CATALOG_ADR_DOCUMENT_TEMPLATE_NAME,
  ADR_DOCUMENT_TYPE_NAME as CATALOG_ADR_DOCUMENT_TYPE_NAME,
  instantiateTemplateDocuments
} from '../catalog/schemaTemplates';

export const ADR_DOCUMENT_TYPE_NAME = CATALOG_ADR_DOCUMENT_TYPE_NAME;
export const ADR_DOCUMENT_TEMPLATE_NAME = CATALOG_ADR_DOCUMENT_TEMPLATE_NAME;

export const buildDefaultAdrDocuments = (workspace: string, now: Date) => {
  const { documentTypes, documentTemplates } = instantiateTemplateDocuments(
    workspace,
    'backstage',
    now
  );
  const documentType = documentTypes.find(type => type.name === ADR_DOCUMENT_TYPE_NAME);
  const template = documentTemplates.find(
    documentTemplate => documentTemplate.name === ADR_DOCUMENT_TEMPLATE_NAME
  );
  if (!documentType || !template) {
    throw new Error('The built-in ADR definition is missing from the template catalog');
  }
  return { documentType, template };
};
