export type RenderableMessagePart = {
  type: string;
  content?: string;
  name?: string;
  approval?: { needsApproval: boolean };
};

export const hasRenderableParts = (parts: RenderableMessagePart[]) =>
  parts.some(
    part =>
      (part.type === 'text' && (part.content?.trim().length ?? 0) > 0) ||
      (part.type === 'tool-call' &&
        (part.name === 'create_entity' || part.name === 'update_entity') &&
        part.approval?.needsApproval)
  );

export const optimisticConversationTitle = (text: string) =>
  text.length > 50 ? `${text.substring(0, 47)}...` : text;
