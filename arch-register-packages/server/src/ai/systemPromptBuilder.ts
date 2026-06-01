import type { DatabaseAdapter } from '../db/database.js';

export const buildSystemPrompt = async (
  db: DatabaseAdapter,
  workspaceId: string,
  customPrompt: string | null
): Promise<string> => {
  const schemas = await db.catalog.listSchemas(workspaceId);
  const entities = await db.catalog.listEntities(workspaceId);
  const lifecycleStates = await db.workspaceAdmin.listLifecycleStates(workspaceId);
  const teams = await db.workspaceAdmin.listTeams(workspaceId);

  const entityCountsBySchema = new Map<string, number>();
  for (const entity of entities) {
    const count = entityCountsBySchema.get(entity.schema_id) ?? 0;
    entityCountsBySchema.set(entity.schema_id, count + 1);
  }

  const schemaDescriptions = schemas.map(s => {
    const count = entityCountsBySchema.get(s.id) ?? 0;
    const fields = s.fields.map(f => `  - ${f.name} (${f.type})`).join('\n');
    return `### ${s.name} (${count} entities)\nFields:\n${fields}`;
  }).join('\n\n');

  const lifecycleDesc = lifecycleStates.length > 0
    ? `Available lifecycle states: ${lifecycleStates.map(s => s.label).join(', ')}`
    : 'No lifecycle states configured.';

  const teamsDesc = teams.length > 0
    ? `Teams: ${teams.map(t => t.id).join(', ')}`
    : 'No teams configured.';

  const parts = [
    `You are an architecture assistant for an Enterprise Architecture tool called Arch Register.`,
    `You help users understand and manage their IT architecture model.`,
    ``,
    `## Current workspace model`,
    `Total entities: ${entities.length}`,
    ``,
    schemaDescriptions,
    ``,
    lifecycleDesc,
    teamsDesc,
    ``,
    `## Your capabilities`,
    `- Answer questions about entities, relationships, schemas, and the overall model`,
    `- Propose adding new entities or editing existing ones`,
    `- Summarize model health, gaps, and risks`,
    `- Help identify dependencies and ownership`,
    ``,
    `## Guidelines`,
    `- Be concise and specific. Reference entity names and types.`,
    `- When proposing changes, describe what you'd add or modify clearly.`,
    `- Use markdown formatting for readability (bold, bullets, etc).`,
    `- If you don't have enough context to answer, say so.`,
  ];

  if (customPrompt) {
    parts.push(``, `## Additional instructions`, customPrompt);
  }

  return parts.join('\n');
};
