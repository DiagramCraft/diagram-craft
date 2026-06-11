import { describe, it, expect } from 'vitest';
import { projectContract } from './projectContract';

describe('projectContract', () => {
  describe('projects', () => {
    it('should validate list input', () => {
      const result = projectContract.projects.list._def.input.safeParse({
        params: { workspace: 'test-workspace' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate get input', () => {
      const result = projectContract.projects.get._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate create input', () => {
      const result = projectContract.projects.create._def.input.safeParse({
        params: { workspace: 'test-workspace' },
        body: {
          name: 'New Project',
          description: 'Test project',
          status: 'active'
        }
      });
      expect(result.success).toBe(true);
    });

    it('should validate update input', () => {
      const result = projectContract.projects.update._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123' },
        body: {
          name: 'Updated Project',
          description: 'Updated description',
          status: 'archived'
        }
      });
      expect(result.success).toBe(true);
    });

    it('should validate remove input', () => {
      const result = projectContract.projects.remove._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate listFiles input', () => {
      const result = projectContract.projects.listFiles._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate createFolder input', () => {
      const result = projectContract.projects.createFolder._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123' },
        body: { path: 'folder/subfolder' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate renameFolder input', () => {
      const result = projectContract.projects.renameFolder._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123' },
        body: { oldPath: 'old-folder', newPath: 'new-folder' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate deleteFolder input', () => {
      const result = projectContract.projects.deleteFolder._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123', path: 'folder/to/delete' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate getFileContent input', () => {
      const result = projectContract.projects.getFileContent._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123', path: 'diagram.json' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate saveFile input', () => {
      const result = projectContract.projects.saveFile._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123', path: 'diagram.json' },
        body: { name: 'My Diagram', diagrams: [] }
      });
      expect(result.success).toBe(true);
    });

    it('should validate deleteFile input', () => {
      const result = projectContract.projects.deleteFile._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123', path: 'diagram.json' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate cloneFile input', () => {
      const result = projectContract.projects.cloneFile._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123', path: 'diagram.json' }
      });
      expect(result.success).toBe(true);
    });

    it('should validate relocateFile input', () => {
      const result = projectContract.projects.relocateFile._def.input.safeParse({
        params: { workspace: 'test-workspace', id: 'project-123', path: 'old/diagram.json' },
        body: { newPath: 'new/diagram.json' }
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid workspace in params', () => {
      const result = projectContract.projects.list._def.input.safeParse({
        params: { workspace: '' }
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid project status', () => {
      const result = projectContract.projects.create._def.input.safeParse({
        params: { workspace: 'test-workspace' },
        body: {
          name: 'New Project',
          status: 'invalid-status'
        }
      });
      expect(result.success).toBe(false);
    });
  });
});
