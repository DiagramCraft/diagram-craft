import { useState, useEffect, useCallback, useRef } from 'react';
import type { NavigateFn } from '../routing';
import styles from './DiagramScreen.module.css';
import '../diagram/diagramCraft.css';
import { TbArrowLeft, TbDeviceFloppy } from 'react-icons/tb';
import { initDiagramCraft, INCLUDED_PACKAGES } from '../diagram/diagramCraftSetup';
import { EditableCanvas } from '@diagram-craft/canvas-react/EditableCanvas';
import { Application } from '@diagram-craft/canvas-app/application';
import { canvasAppActions, defaultMacKeymap } from '@diagram-craft/canvas-app/canvasAppActions';
import { makeActionMap } from '@diagram-craft/canvas/keyMap';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { CRDT } from '@diagram-craft/collaboration/crdt';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Diagram } from '@diagram-craft/model/diagram';
import { MoveTool } from '@diagram-craft/canvas/tools/moveTool';
import { TextTool } from '@diagram-craft/canvas-app/tools/textTool';
import { EdgeTool } from '@diagram-craft/canvas-app/tools/edgeTool';
import { NodeTool } from '@diagram-craft/canvas/tools/nodeTool';
import { PenTool } from '@diagram-craft/canvas-app/tools/penTool';
import { FreehandTool } from '@diagram-craft/canvas-app/tools/freehandTool';
import { PanTool } from '@diagram-craft/canvas-app/tools/panTool';
import { RectTool } from '@diagram-craft/canvas-app/tools/rectTool';
import { ZoomTool } from '@diagram-craft/canvas-app/tools/zoomTool';
import { Point } from '@diagram-craft/geometry/point';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';
import type { ToolConstructor, ToolType } from '@diagram-craft/canvas/tool';

const tools: Record<ToolType, ToolConstructor> = {
  move: MoveTool,
  text: TextTool,
  edge: EdgeTool,
  node: NodeTool,
  pen: PenTool,
  freehand: FreehandTool,
  pan: PanTool,
  rect: RectTool,
  zoom: ZoomTool
};

interface DiagramScreenProps {
  workspaceId: string;
  projectId: string;
  diagramId: string;
  navigate: NavigateFn;
}

export const DiagramScreen = ({ workspaceId, projectId, diagramId, navigate }: DiagramScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ path: string; name: string } | null>(null);
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [saving, setSaving] = useState(false);

  const docRef = useRef<DiagramDocument | null>(null);
  const appRef = useRef<Application | null>(null);

  // Fetch file info and load diagram
  useEffect(() => {
    const loadDiagram = async () => {
      try {
        setLoading(true);

        // Initialize diagram-craft (idempotent)
        const { documentFactory, diagramFactory } = initDiagramCraft();

        // Fetch project to get file info
        const projectResponse = await fetch(`/api/${workspaceId}/projects/${projectId}`);
        if (!projectResponse.ok) throw new Error('Failed to load project');
        const project = await projectResponse.json();

        // Find the file in the project
        const findFile = (folders: any[], rootFiles: any[]) => {
          for (const file of rootFiles) {
            if (file.id === diagramId) return file;
          }
          for (const folder of folders) {
            for (const file of folder.files) {
              if (file.id === diagramId) return file;
            }
          }
          return null;
        };

        const file = findFile(project.files.folders, project.files.rootFiles);
        if (!file) throw new Error('Diagram file not found');
        setFileInfo({ path: file.path, name: file.name });

        // Fetch diagram content
        const diagramResponse = await fetch(
          `/api/${workspaceId}/projects/${projectId}/files/${file.path}`
        );
        if (!diagramResponse.ok) throw new Error('Failed to load diagram content');
        const diagramData = await diagramResponse.json();

        // Create document and deserialize
        const root = CRDT.makeRoot();
        const doc = await documentFactory.createDocument(root, undefined, () => {});
        await deserializeDiagramDocument(diagramData, doc, diagramFactory, {
          includedPackages: INCLUDED_PACKAGES
        });
        await doc.load();

        if (doc.diagrams.length === 0) {
          throw new Error('Diagram file contains no diagrams');
        }

        docRef.current = doc;

        // Set up Application
        const app = new Application();
        app.model.setActiveDocument(doc, { name: 'User', color: '#3b82f6' }, () => {});
        app.model.activeDiagram = doc.diagrams[0]!;
        app.actions = makeActionMap(canvasAppActions)(app);
        app.ui = {
          showContextMenu: () => {},
          showNodeLinkPopup: () => {},
          showDialog: () => {}
        };
        app.help = {
          set: () => {},
          push: () => {},
          pop: () => {}
        };
        appRef.current = app;

        setDiagram(doc.diagrams[0]!);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load diagram');
        setLoading(false);
      }
    };

    loadDiagram();

    return () => {
      // Cleanup on unmount
      if (docRef.current) {
        docRef.current.deactivate(() => {});
        docRef.current.release();
        docRef.current = null;
      }
      appRef.current = null;
    };
  }, [workspaceId, projectId, diagramId]);

  const handleClose = useCallback(() => {
    navigate({ view: 'project-detail', projectId });
  }, [navigate, projectId]);

  const handleSave = useCallback(async () => {
    if (!docRef.current || !fileInfo) return;

    setSaving(true);
    try {
      const serialized = await serializeDiagramDocument(docRef.current);
      const response = await fetch(
        `/api/${workspaceId}/projects/${projectId}/files/${fileInfo.path}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serialized)
        }
      );
      if (!response.ok) throw new Error('Failed to save diagram');
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [workspaceId, projectId, fileInfo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, handleSave]);

  if (loading) {
    return (
      <div className={styles.diagramScreen}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading diagram...</p>
        </div>
      </div>
    );
  }

  if (error || !fileInfo || !diagram || !appRef.current) {
    return (
      <div className={styles.diagramScreen}>
        <div className={styles.error}>
          <p>Error: {error ?? 'Failed to load diagram'}</p>
          <button onClick={handleClose} className={styles.button}>
            Back to Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.diagramScreen} dc-editor`}>
      <div className={styles.header}>
        <button onClick={handleClose} className={styles.backButton} title="Back to project (Esc)">
          <TbArrowLeft size={18} />
          <span>Back</span>
        </button>
        <h1 className={styles.title}>{fileInfo.name}</h1>
        <div className={styles.headerActions}>
          <button
            onClick={handleSave}
            className={styles.saveButton}
            disabled={saving}
            title="Save (Cmd+S)"
          >
            <TbDeviceFloppy size={16} />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>
      <div className={styles.canvasContainer}>
        <EditableCanvas
          id={CanvasDomHelper.diagramId(diagram)}
          key={diagram.uid}
          diagram={diagram}
          actionMap={appRef.current.actions}
          tools={tools}
          keyMap={defaultMacKeymap}
          offset={Point.ORIGIN}
          context={appRef.current}
        />
      </div>
    </div>
  );
};
