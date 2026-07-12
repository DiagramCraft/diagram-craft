import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from '@tanstack/react-router';
import { Canvas } from '@diagram-craft/canvas-react/Canvas';
import { StaticCanvasComponent } from '@diagram-craft/canvas/canvas/StaticCanvasComponent';
import type { StaticCanvasProps } from '@diagram-craft/canvas/canvas/StaticCanvasComponent';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import type { Diagram } from '@diagram-craft/model/diagram';
import { model } from '@diagram-craft/canvas/modelState';
import { Observable } from '@diagram-craft/canvas/component/component';
import { Marquee } from '@diagram-craft/canvas/marquee';
import type { Context } from '@diagram-craft/canvas/context';
import type { ToolType } from '@diagram-craft/canvas/tool';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useProjectFile, useProjectFileContent } from '../../../../../hooks/useProjectFiles';
import { initializeDiagramCraft } from '../../../../../diagramcraft-initial-config';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDiagramRoute,
  projectDiagramRoute
} from '../../../../../routes/publicObjectRoutes';
import { useMarkdownDiagramSession } from '../../../MarkdownDiagramSessionContext';
import { EmptyState } from '../../../../../components/EmptyState';
import styles from './DiagramEmbed.module.css';

const boundsViewbox = (diagram: Diagram): string => {
  const b = diagram.bounds;
  return `${b.x} ${b.y} ${b.w} ${b.h}`;
};

const VIEWER_CONTEXT: Context = {
  model,
  ui: {
    showContextMenu: () => {},
    showNodeLinkPopup: () => {},
    showDialog: () => {}
  },
  help: { push: () => {}, pop: () => {}, set: () => {} },
  tool: new Observable<ToolType>('move'),
  actions: {},
  marquee: new Marquee(),
  actionState: new Observable<'enabled' | 'disabled'>('enabled')
};

export const DiagramEmbed = ({ id, caption }: { id: string; caption?: string }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: file, isLoading, isError } = useProjectFile(workspaceSlug, id);
  const { data: rawContent } = useProjectFileContent(workspaceSlug, id);
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams({ strict: false });
  const { sessionId } = useMarkdownDiagramSession();

  useEffect(() => {
    if (!rawContent) return;
    const { registry, diagramFactory, includedPackages } = initializeDiagramCraft(workspaceSlug);
    const doc = new DiagramDocument(registry);
    const serialized = rawContent as unknown as SerializedDiagramDocument;
    deserializeDiagramDocument(serialized, doc, diagramFactory, { includedPackages })
      .then(() => {
        const d = serialized.activeDiagramId
          ? doc.diagrams.find(x => x.id === serialized.activeDiagramId)
          : doc.diagrams[0];
        setDiagram(d ?? null);
      })
      .catch(() => setDiagram(null));
  }, [rawContent, workspaceSlug]);

  if (!id) return null;

  const handleClick = () => {
    if (!file) return;
    const returnTo = location.href;
    const search = {
      returnTo,
      markdownSessionId: sessionId
    };

    if (file.project_public_id) {
      void navigate(
        projectDiagramRoute(workspaceSlug, asProjectPublicId(file.project_public_id), file.id, search)
      );
    } else if (params.entityId) {
      void navigate(
        entityDiagramRoute(workspaceSlug, asEntityPublicId(params.entityId), file.id, search)
      );
    } else {
      void navigate({
        to: '/$workspaceSlug/content/diagrams/$diagramId',
        params: { workspaceSlug, diagramId: file.id },
        search
      });
    }
  };

  if (isLoading) {
    return (
      <figure className={styles.container}>
        <div className={styles.loading}>Loading…</div>
      </figure>
    );
  }

  if (isError || !file) {
    return (
      <figure className={`${styles.container} ${styles.error}`}>
        <span className={styles.errorText}>Diagram not found: {id}</span>
      </figure>
    );
  }

  if (diagram) {
    return (
      <figure className={`${styles.container} ${styles.clickable}`} onClick={handleClick}>
        <Canvas<StaticCanvasComponent, StaticCanvasProps>
          id={`diagram-embed-${id}`}
          context={VIEWER_CONTEXT}
          diagram={diagram}
          viewbox={boundsViewbox(diagram)}
          width="100%"
          canvasFactory={() => new StaticCanvasComponent()}
        />
        {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
      </figure>
    );
  }

  if (file.preview_svg) {
    return (
      <figure className={`${styles.container} ${styles.clickable}`} onClick={handleClick}>
        <div className={styles.svgWrapper} dangerouslySetInnerHTML={{ __html: file.preview_svg }} />
        {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
      </figure>
    );
  }

  return (
    <figure className={`${styles.container} ${styles.clickable}`} onClick={handleClick}>
      <EmptyState compact title="No preview available" />
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
};
