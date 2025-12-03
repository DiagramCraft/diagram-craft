import { describe, test, expect } from 'vitest';
import { extractJSON } from './aiContentParser';

describe('extractJSON', () => {
  test('should extract JSON from markdown code block with json tag', () => {
    const content = `Here's your diagram:

\`\`\`json
{
  "action": "create",
  "nodes": [
    { "id": "node1", "type": "rect" }
  ]
}
\`\`\``;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'create',
      nodes: [{ id: 'node1', type: 'rect' }]
    });
  });

  test('should extract JSON from markdown code block without language tag', () => {
    const content = `\`\`\`
{
  "action": "add",
  "nodes": [
    { "id": "node2", "type": "circle" }
  ]
}
\`\`\``;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'add',
      nodes: [{ id: 'node2', type: 'circle' }]
    });
  });

  test('should extract JSON object from plain text', () => {
    const content = `Here is the JSON: { "action": "modify", "modifications": [] }`;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'modify',
      modifications: []
    });
  });

  test('should return undefined when multiple JSON objects present without code block', () => {
    // The regex matches from first { to last }, which creates invalid JSON
    const content = `{ "action": "create" } and also { "action": "delete" }`;

    const result = extractJSON(content);

    // This fails to parse because it captures: { "action": "create" } and also { "action": "delete" }
    expect(result).toBeUndefined();
  });

  test('should extract nested JSON correctly', () => {
    const content = `\`\`\`json
{
  "action": "create",
  "nodes": [
    {
      "id": "node1",
      "metadata": {
        "nested": {
          "value": true
        }
      }
    }
  ]
}
\`\`\``;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'create',
      nodes: [
        {
          id: 'node1',
          metadata: {
            nested: {
              value: true
            }
          }
        }
      ]
    });
  });

  test('should return undefined for invalid JSON', () => {
    const content = `This is not JSON at all`;

    const result = extractJSON(content);

    expect(result).toBeUndefined();
  });

  test('should return undefined for malformed JSON', () => {
    const content = `\`\`\`json
{
  "action": "create",
  "nodes": [
    { "id": "node1" }
  ]
  // missing closing brace
\`\`\``;

    const result = extractJSON(content);

    expect(result).toBeUndefined();
  });

  test('should handle JSON with trailing text after code block', () => {
    const content = `\`\`\`json
{
  "action": "create",
  "nodes": []
}
\`\`\`

This diagram shows the basic structure.`;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'create',
      nodes: []
    });
  });

  test('should handle empty JSON object', () => {
    const content = `\`\`\`json
{}
\`\`\``;

    const result = extractJSON(content);

    expect(result).toEqual({});
  });

  test('should handle JSON arrays', () => {
    const content = `\`\`\`json
{
  "action": "remove",
  "removeIds": ["node1", "node2", "node3"]
}
\`\`\``;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'remove',
      removeIds: ['node1', 'node2', 'node3']
    });
  });

  test('should extract JSON from text with leading explanation', () => {
    const content = `I'll create that diagram for you:

\`\`\`json
{
  "action": "create",
  "layout": "auto",
  "nodes": [
    { "id": "start", "type": "circle" }
  ]
}
\`\`\`

The diagram has been created.`;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'create',
      layout: 'auto',
      nodes: [{ id: 'start', type: 'circle' }]
    });
  });
});
