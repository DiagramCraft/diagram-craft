import { createContext, useContext, type ReactNode } from 'react';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { EditorField, EditorGroup, SchemaEditorController } from './schemaEditorState';

// The controller is generic over the field/group/extra types of each editor; the context
// stores it type-erased and `useSchemaEditor` restores the caller's types.
// biome-ignore lint/suspicious/noExplicitAny: type-erased storage, see above
type AnyController = SchemaEditorController<any, any, any, any, any>;

const SchemaEditorContext = createContext<AnyController | null>(null);

/** Makes a schema editor controller available to everything rendered inside the editor. */
export const SchemaEditorProvider = ({
  editor,
  children
}: {
  editor: AnyController;
  children: ReactNode;
}) => <SchemaEditorContext.Provider value={editor}>{children}</SchemaEditorContext.Provider>;

export const useSchemaEditor = <
  Field extends EditorField = EditorField,
  Group extends EditorGroup = EditorGroup,
  Extra extends object = Record<never, never>,
  Selected extends { id: string } = { id: string },
  FieldType extends string = string
>() => {
  const editor = useContext(SchemaEditorContext);
  if (!editor) throw new Error('useSchemaEditor must be used inside a SchemaEditorProvider');
  return editor as SchemaEditorController<Selected, Field, Group, Extra, FieldType>;
};

/** Like `useSchemaEditor`, but returns null outside a provider (for rows reused elsewhere). */
export const useOptionalSchemaEditor = <
  Field extends EditorField = EditorField,
  Group extends EditorGroup = EditorGroup
>() =>
  useContext(SchemaEditorContext) as SchemaEditorController<
    { id: string },
    Field,
    Group,
    Record<never, never>,
    string
  > | null;

/** Whether the current user may edit schemas, enums and other data-model definitions. */
export const useCanEditSchemas = () => useWorkspaceContext().permissions.canEditSchemas;
