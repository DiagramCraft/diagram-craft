import type {
  DocumentField,
  DocumentMetadata,
  DocumentTemplateWrite,
  DocumentTypeWrite
} from '@arch-register/api-types/documentContract';

export type DocumentTypeDbResult = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  fields: DocumentField[];
  color: string | null;
  icon: string | null;
  archived: boolean;
  /** Defaults to 1 on create; omit on update to leave the current version unchanged. */
  version?: number;
  created_at: Date;
  updated_at: Date;
};

export type DocumentTypeDbCreate = DocumentTypeWrite & {
  id: string;
  workspace: string;
  created_at: Date;
  updated_at: Date;
};

// -- Document Type Version

export type DocumentTypeVersionDbResult = {
  id: string;
  workspace: string;
  document_type_id: string;
  version: number;
  name: string;
  description: string;
  fields: DocumentField[];
  color: string | null;
  icon: string | null;
  change_summary: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
};

export type DocumentTypeVersionDbCreate = DocumentTypeVersionDbResult;

export type DocumentTemplateDbResult = {
  id: string;
  workspace: string;
  project_id: string | null;
  name: string;
  body: string;
  document_type_id: string;
  metadata_defaults: DocumentMetadata;
  archived: boolean;
  created_at: Date;
  updated_at: Date;
};

export type DocumentTemplateDbCreate = DocumentTemplateWrite & {
  id: string;
  workspace: string;
  created_at: Date;
  updated_at: Date;
};

export type DocumentMetadataDbResult = {
  workspace: string;
  node_id: string;
  document_type_id: string | null;
  values: DocumentMetadata;
  updated_at: Date;
};

export type DocumentMetadataDbUpsert = DocumentMetadataDbResult;

export type DocumentLinkIndexDbResult = {
  workspace: string;
  node_id: string;
  field_id: string;
  target_type: 'entity' | 'document';
  target_id: string;
  position: number;
};

export type DocumentDatabase = {
  listDocumentTypes(workspace: string, includeArchived?: boolean): Promise<DocumentTypeDbResult[]>;
  getDocumentType(workspace: string, id: string): Promise<DocumentTypeDbResult | null>;
  createDocumentType(input: DocumentTypeDbCreate): Promise<DocumentTypeDbResult>;
  updateDocumentType(
    workspace: string,
    id: string,
    input: DocumentTypeWrite & { updated_at: Date; version?: number }
  ): Promise<DocumentTypeDbResult | null>;
  archiveDocumentType(
    workspace: string,
    id: string,
    archived: boolean,
    updated_at: Date
  ): Promise<DocumentTypeDbResult | null>;
  deleteDocumentType(workspace: string, id: string): Promise<void>;

  listDocumentTypeVersions(
    workspace: string,
    documentTypeId: string
  ): Promise<DocumentTypeVersionDbResult[]>;
  createDocumentTypeVersion(
    input: DocumentTypeVersionDbCreate
  ): Promise<DocumentTypeVersionDbResult>;

  renameDocumentMetadataField(
    workspace: string,
    documentTypeId: string,
    oldFieldId: string,
    newFieldId: string
  ): Promise<number>;
  removeDocumentMetadataField(
    workspace: string,
    documentTypeId: string,
    fieldId: string
  ): Promise<number>;
  listDocumentTemplates(
    workspace: string,
    projectId?: string | null,
    includeArchived?: boolean
  ): Promise<DocumentTemplateDbResult[]>;
  getDocumentTemplate(workspace: string, id: string): Promise<DocumentTemplateDbResult | null>;
  createDocumentTemplate(input: DocumentTemplateDbCreate): Promise<DocumentTemplateDbResult>;
  updateDocumentTemplate(
    workspace: string,
    id: string,
    input: DocumentTemplateWrite & { updated_at: Date }
  ): Promise<DocumentTemplateDbResult | null>;
  archiveDocumentTemplate(
    workspace: string,
    id: string,
    archived: boolean,
    updated_at: Date
  ): Promise<DocumentTemplateDbResult | null>;
  deleteDocumentTemplate(workspace: string, id: string): Promise<void>;
  getDocumentMetadata(workspace: string, nodeId: string): Promise<DocumentMetadataDbResult | null>;
  upsertDocumentMetadata(input: DocumentMetadataDbUpsert): Promise<void>;
  deleteDocumentMetadata(workspace: string, nodeId: string): Promise<void>;
  listDocumentLinks(workspace: string, nodeId: string): Promise<DocumentLinkIndexDbResult[]>;
  replaceDocumentLinks(
    workspace: string,
    nodeId: string,
    links: Omit<DocumentLinkIndexDbResult, 'workspace' | 'node_id'>[]
  ): Promise<void>;
  listDocumentsLinkingEntity(
    workspace: string,
    entityId: string
  ): Promise<DocumentLinkIndexDbResult[]>;
  listDocumentsLinkingDocument(
    workspace: string,
    documentId: string
  ): Promise<DocumentLinkIndexDbResult[]>;
};
