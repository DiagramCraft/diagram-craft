import { describe, expect, it } from 'vitest';
import { buildTemplateStatusUpdateInput, decodeRouteParam } from './templates';

describe('template route helpers', () => {
  it('decodes route params', () => {
    expect(decodeRouteParam('diagrams%2Ffoo.json', 'path')).toBe('diagrams/foo.json');
  });

  it('rejects missing route params', () => {
    expect(() => decodeRouteParam(undefined, 'projectId')).toThrowError('projectId is required');
  });

  it('builds template status update input', () => {
    expect(
      buildTemplateStatusUpdateInput({
        is_template: true,
        is_workspace_template: false
      })
    ).toEqual({
      is_template: true,
      is_workspace_template: false
    });
  });

  it('rejects invalid template status bodies', () => {
    expect(() => buildTemplateStatusUpdateInput(undefined)).toThrowError(
      'Request body must be a JSON object'
    );
    expect(() =>
      buildTemplateStatusUpdateInput({
        is_template: 'yes',
        is_workspace_template: false
      })
    ).toThrowError('is_template must be a boolean');
    expect(() =>
      buildTemplateStatusUpdateInput({
        is_template: true,
        is_workspace_template: 'no'
      })
    ).toThrowError('is_workspace_template must be a boolean');
  });
});
