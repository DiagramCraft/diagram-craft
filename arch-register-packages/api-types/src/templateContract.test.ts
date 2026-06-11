import { describe, it, expect } from 'vitest';
import { workspaceTemplateContract } from './templateContract';

describe('workspaceTemplateContract', () => {
  describe('templates', () => {
    it('should validate listAll input', () => {
      const result = workspaceTemplateContract.templates.listAll._def.input.safeParse({
        params: { workspace: 'test-workspace' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate listForProject input', () => {
      const result = workspaceTemplateContract.templates.listForProject._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate toggleStatus input', () => {
      const result = workspaceTemplateContract.templates.toggleStatus._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123', path: 'template.json' },
        body: { is_template: true, is_workspace_template: false }
      });
      expect(result.success).toBe(true);
    });

    it('should validate createFromTemplate input', () => {
      const result = workspaceTemplateContract.templates.createFromTemplate._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123' },
        body: {
          name: 'New Diagram',
          templateProjectId: 'template-project-456',
          templatePath: 'template.json',
          folder: 'diagrams'
        }
      });
      expect(result.success).toBe(true);
    });

    it('should validate createFromTemplate input with null folder', () => {
      const result = workspaceTemplateContract.templates.createFromTemplate._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123' },
        body: {
          name: 'New Diagram',
          templateProjectId: 'template-project-456',
          templatePath: 'template.json',
          folder: null
        }
      });
      expect(result.success).toBe(true);
    });

    it('should validate createFromTemplate input without folder', () => {
      const result = workspaceTemplateContract.templates.createFromTemplate._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123' },
        body: {
          name: 'New Diagram',
          templateProjectId: 'template-project-456',
          templatePath: 'template.json'
        }
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid workspace in params', () => {
      const result = workspaceTemplateContract.templates.listAll._def.input.safeParse({
        params: { workspace: '' }
      });
      expect(result.success).toBe(false);
    });

    it('should reject toggleStatus with missing body fields', () => {
      const result = workspaceTemplateContract.templates.toggleStatus._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123', path: 'template.json' },
        body: { is_template: true }
      });
      expect(result.success).toBe(false);
    });

    it('should reject createFromTemplate with missing required fields', () => {
      const result = workspaceTemplateContract.templates.createFromTemplate._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123' },
        body: {
          name: 'New Diagram'
        }
      });
      expect(result.success).toBe(false);
    });
  });
});
