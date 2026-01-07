import { Diagram } from '../diagram';
import { DiagramNode } from '../diagramNode';
import { DiagramEdge } from '../diagramEdge';
import { UnitOfWork } from '../unitOfWork';
import { isSerializedEndpointAnchor, isSerializedEndpointPointInNode } from './utils';
import { DiagramDocument } from '../diagramDocument';
import { assert, VerifyNotReached } from '@diagram-craft/utils/assert';
import {
  SerializedAnchorEndpoint,
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedElement,
  SerializedFreeEndpoint,
  type SerializedOverride,
  SerializedPointInNodeEndpoint,
  SerializedStylesheet
} from './serializedTypes';
import { Endpoint } from '../endpoint';
import { DiagramStyles, Stylesheet } from '../diagramStyles';
import { DefaultStyles } from '../diagramDefaults';
import { ReferenceLayer } from '../diagramLayerReference';
import { RuleLayer } from '../diagramLayerRule';
import { type DataProvider, DataProviderRegistry } from '../dataProvider';
import { RegularLayer } from '../diagramLayerRegular';
import { ModificationLayer } from '../diagramLayerModification';
import type { DiagramFactory } from '../diagramDocumentFactory';
import { Comment } from '../comment';
import type { DataManager } from '../diagramDocumentData';
import { ElementLookup } from '../elementLookup';
import { ElementFactory } from '../elementFactory';
import { DelegatingDiagramNode } from '../delegatingDiagramNode';
import type { DiagramElement } from '../diagramElement';
import { DelegatingDiagramEdge } from '../delegatingDiagramEdge';
import { Box } from '@diagram-craft/geometry/box';

const unfoldGroup = (node: SerializedElement) => {
  const recurse = (
    nodes: ReadonlyArray<SerializedElement>,
    parent?: SerializedElement
  ): (SerializedElement & { parent?: SerializedElement | undefined })[] => {
    return [
      ...nodes.map(n => ({ ...n, parent })),
      ...nodes.flatMap(n => recurse(n.children ?? [], n))
    ];
  };

  if ((node.children ?? []).length > 0) {
    return [...recurse(node.children ?? [], node), { ...node }];
  } else {
    return [{ ...node }];
  }
};

const deserializeEndpoint = (
  e: SerializedAnchorEndpoint | SerializedPointInNodeEndpoint | SerializedFreeEndpoint,
  nodeLookup: ElementLookup<DiagramNode>
) => {
  return Endpoint.deserialize(e, nodeLookup);
};

export const deserializeDiagramElements = (
  diagramElements: ReadonlyArray<SerializedElement>,
  layer: RegularLayer | ModificationLayer,
  uow: UnitOfWork,
  nodeLookup?: ElementLookup<DiagramNode>,
  edgeLookup?: ElementLookup<DiagramEdge>
) => {
  nodeLookup ??= new ElementLookup<DiagramNode>();
  edgeLookup ??= new ElementLookup<DiagramEdge>();
  // Pass 1: create placeholders for all nodes
  for (const n of diagramElements) {
    for (const c of unfoldGroup(n)) {
      if (c.type !== 'node') continue;

      COMPATIBILITY: {
        // Note: this is for backwards compatibility only
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        const textProps: any = c.props.text;
        if (textProps?.text && (!c.texts || !c.texts.text)) {
          c.texts ??= { text: textProps.text };
          c.texts.text = textProps.text;
          delete textProps.text;
        }
      }

      const node = ElementFactory.node(
        c.id,
        c.nodeType,
        c.bounds,
        layer,
        c.props,
        {
          style: c.nodeType === 'text' ? DefaultStyles.node.text : DefaultStyles.node.default,
          ...c.metadata
        },
        c.texts,
        c.anchors
      );
      node.setTags(c.tags ?? [], uow);
      nodeLookup.set(c.id, node);
    }
  }

  // Pass 2: create placeholders for all edges
  for (const n of diagramElements) {
    for (const e of unfoldGroup(n)) {
      if (e.type !== 'edge') continue;

      const { start, end } = e;

      const startEndpoint = deserializeEndpoint(start, nodeLookup);
      const endEndpoint = deserializeEndpoint(end, nodeLookup);

      const edge = ElementFactory.edge(
        e.id,
        startEndpoint,
        endEndpoint,
        e.props,
        {
          style: 'default-edge',
          ...e.metadata
        },
        e.waypoints ?? [],
        layer
      );
      edge.setTags(e.tags ?? [], uow);

      if (isSerializedEndpointAnchor(start)) {
        const startNode = nodeLookup.get(start.node.id)!;
        startNode._addEdge(start.anchor, edge);
      } else if (isSerializedEndpointPointInNode(start)) {
        const startNode = nodeLookup.get(start.node.id)!;
        startNode._addEdge(undefined, edge);
      }

      if (isSerializedEndpointAnchor(end)) {
        const endNode = nodeLookup.get(end.node.id)!;
        endNode._addEdge(end.anchor, edge);
      } else if (isSerializedEndpointPointInNode(end)) {
        const endNode = nodeLookup.get(end.node.id)!;
        endNode._addEdge(undefined, edge);
      }

      edgeLookup.set(e.id, edge);
    }
  }

  // Pass 3: resolve relations
  for (const n of diagramElements) {
    for (const c of unfoldGroup(n)) {
      const el = c.type === 'node' ? nodeLookup.get(c.id)! : edgeLookup.get(c.id)!;
      el.setChildren(
        c.children?.map(c2 => (nodeLookup.get(c2.id) ?? edgeLookup.get(c2.id))!) ?? [],
        uow
      );

      if (c.parent) {
        const resolvedParent = nodeLookup.get(c.parent.id) ?? edgeLookup.get(c.parent.id);
        el._setParent(resolvedParent);
      }

      if (c.type === 'edge') {
        const edge = edgeLookup.get(c.id)!;
        if (c.labelNodes && c.labelNodes.length > 0) {
          edge.setLabelNodes(
            c.labelNodes.map(ln => ({ ...ln, node: () => nodeLookup.get(ln.id)! })),
            uow
          );
        }
      }
    }
  }

  // Pass 4: gather all elements - only keep the top-level elements
  return diagramElements
    .map(n => (n.type === 'node' ? nodeLookup.get(n.id)! : edgeLookup.get(n.id)!))
    .filter(e => e.parent === undefined);
};

export const deserializeDiagramDocument = async <T extends Diagram>(
  document: SerializedDiagramDocument,
  doc: DiagramDocument,
  diagramFactory: DiagramFactory<T>
): Promise<void> => {
  const diagrams = document.diagrams;

  // Read hash if present
  if (document.hash) {
    doc.hash = document.hash;
  }

  doc.root.transact(() => {
    doc.customPalette.setColors(document.customPalette);

    for (const edgeStyle of document.styles.edgeStyles) {
      UnitOfWork.executeSilently(undefined, uow =>
        doc.styles.addStylesheet(edgeStyle.id, deserializeStylesheet(edgeStyle, doc.styles), uow)
      );
    }
    for (const nodeStyle of document.styles.nodeStyles) {
      UnitOfWork.executeSilently(undefined, uow =>
        doc.styles.addStylesheet(nodeStyle.id, deserializeStylesheet(nodeStyle, doc.styles), uow)
      );
    }

    for (const schema of document.schemas) {
      doc.data._schemas.add(schema);

      // Set metadata if provided, otherwise use backwards-compatible defaults
      const metadata = document.schemaMetadata?.[schema.id] ?? {
        availableForElementLocalData: true,
        useDocumentOverrides: false
      };
      doc.data.setSchemaMetadata(schema.id, metadata);
    }

    const dest = deserializeDiagrams(doc, diagrams, diagramFactory);
    dest.forEach(d => doc.addDiagram(d));

    // Populate document tags from all element tags
    const tags = new Set<string>();
    for (const diagram of doc.diagramIterator({ nest: true })) {
      for (const el of diagram.allElements()) {
        el.tags.forEach(t => tags.add(t));
      }
    }
    if (tags.size > 0) {
      doc.tags.set(Array.from(tags));
    }

    if (document.data?.providers) {
      const providers: DataProvider[] = [];
      for (const provider of document.data.providers) {
        const providerFactory = DataProviderRegistry.get(provider.providerId);
        if (!providerFactory) {
          console.warn(`Provider ${provider.providerId} not found`);
        } else {
          const p = providerFactory(provider.data);
          p.id = provider.id;
          providers.push(p);
        }
      }
      doc.data.setProviders(providers, true);
    } else {
      doc.data.setProviders([], true);
    }

    doc.data.templates.replaceBy(document.data?.templates ?? []);

    if (document.data?.overrides) {
      deserializeOverrides(doc.data.db, document.data.overrides);
    }

    if (document.props?.query?.saved) {
      let saved = document.props?.query.saved;
      COMPATIBILITY: {
        if (Array.isArray(document.props.query.saved[0])) {
          saved = [];
        }
      }
      doc.props.query.setSaved(saved);
    }
    if (document.props?.query?.history) {
      let history = document.props?.query.history;
      COMPATIBILITY: {
        if (Array.isArray(document.props.query.history[0])) {
          history = [];
        }
      }
      doc.props.query.setHistory(history);
    }
    if (document.props?.stencils) {
      doc.props.recentStencils.set(document.props.stencils);
    }

    if (document.stories) {
      for (const story of document.stories) {
        const newStory = doc.stories.addStory(story.name);
        for (const step of story.steps) {
          const newStep = doc.stories.addStep(newStory, step.title, step.description);
          if (newStep) {
            for (const action of step.actions) {
              doc.stories.addAction(newStory, newStep, action);
            }
          }
        }
      }
    }
  });

  if (document.attachments) {
    for (const val of Object.values(document.attachments)) {
      const buf = Uint8Array.from(atob(val), c => c.charCodeAt(0));
      await doc.attachments.addAttachment(new Blob([buf]));
    }
  }
};

const deserializeStylesheet = (s: SerializedStylesheet, styles: DiagramStyles) =>
  Stylesheet.fromSnapshot(s.type, s, styles.crdt.factory);

const deserializeDiagrams = <T extends Diagram>(
  doc: DiagramDocument,
  diagrams: ReadonlyArray<SerializedDiagram>,
  diagramFactory: DiagramFactory<T>
) => {
  const dest: T[] = [];
  for (const $d of diagrams) {
    const nodeLookup = new ElementLookup<DiagramNode>();
    const edgeLookup = new ElementLookup<DiagramEdge>();

    const newDiagram = diagramFactory($d, doc);
    newDiagram.bounds = $d.canvas;

    // This needs to be done in multiple steps as later steps depend on earlier ones:
    //
    //  1. Create all layers
    //  2. Fill all layers with elements
    //  3. Load all modifications

    // Create layers
    UnitOfWork.execute(newDiagram, uow => {
      for (const l of $d.layers) {
        switch (l.layerType) {
          case 'regular':
          case 'basic': {
            const layer = new RegularLayer(l.id, l.name, [], newDiagram);
            newDiagram.layers.add(layer, uow);
            if (l.isLocked) layer.setLocked(true, uow);
            break;
          }
          case 'reference': {
            const layer = new ReferenceLayer(l.id, l.name, newDiagram, {
              diagramId: l.diagramId,
              layerId: l.layerId
            });
            newDiagram.layers.add(layer, uow);
            break;
          }
          case 'rule': {
            const layer = new RuleLayer(l.id, l.name, newDiagram, l.rules);
            newDiagram.layers.add(layer, uow);
            break;
          }
          case 'modification': {
            const layer = new ModificationLayer(l.id, l.name, newDiagram, []);
            newDiagram.layers.add(layer, uow);
            if (l.isLocked) layer.setLocked(true, uow);
            break;
          }
          default:
            throw new VerifyNotReached();
        }
      }

      // Fill layers with elements
      for (const l of $d.layers) {
        if (l.layerType === 'regular' || l.layerType === 'basic') {
          const layer = newDiagram.layers.byId(l.id) as RegularLayer | undefined;
          assert.present(layer);

          const elements = deserializeDiagramElements(
            l.elements,
            layer,
            uow,
            nodeLookup,
            edgeLookup
          );

          layer.setElements(elements, uow);

          // Need to invalidate and clear cache, as this may have been
          // populate with partial data during the adding of elements
          layer.elements.forEach(e => {
            e.clearCache();
            e.invalidate(uow);
          });
        }
      }

      // Load modifications
      for (const l of $d.layers) {
        if (l.layerType !== 'modification') continue;

        const layer = newDiagram.layers.byId(l.id) as ModificationLayer;
        for (const modification of l.modifications) {
          if (modification.element) {
            let element: DiagramElement | undefined;

            if (modification.element.type === 'delegating-node') {
              element = new DelegatingDiagramNode(
                modification.element.id,
                nodeLookup.get(modification.id)!,
                layer,
                {
                  bounds: Box.isEqual(
                    modification.element.bounds,
                    nodeLookup.get(modification.id)!.bounds
                  )
                    ? undefined
                    : modification.element.bounds,
                  props: modification.element.props,
                  metadata: modification.element.metadata,
                  texts: modification.element.texts
                }
              );
              nodeLookup.set(modification.element.id, element as DiagramNode);
            } else if (modification.element.type === 'delegating-edge') {
              element = new DelegatingDiagramEdge(
                modification.element.id,
                edgeLookup.get(modification.id)!,
                layer,
                {
                  props: modification.element.props,
                  metadata: modification.element.metadata,
                  start: deserializeEndpoint(modification.element.start, nodeLookup),
                  end: deserializeEndpoint(modification.element.end, nodeLookup),
                  waypoints: modification.element.waypoints
                }
              );
              edgeLookup.set(modification.element.id, element as DiagramEdge);
            } else {
              throw new VerifyNotReached();
            }

            assert.present(element);

            if (modification.type === 'add') {
              layer.modifyAdd(modification.id, element, uow);
            } else if (modification.type === 'change') {
              layer.modifyChange(modification.id, element, uow);
            }
          } else if (modification.type === 'remove') {
            layer.modifyRemove(modification.id, uow);
          }
        }
      }

      if ($d.activeLayerId) {
        const l = newDiagram.layers.byId($d.activeLayerId);
        if (l) {
          newDiagram.layers.active = l;
        }
      }

      if ($d.visibleLayers) {
        for (const layer of newDiagram.layers.all) {
          if (!$d.visibleLayers.includes(layer.id)) {
            newDiagram.layers.toggleVisibility(layer);
          }
        }
      }

      if ($d.zoom) {
        newDiagram.viewBox.zoom($d.zoom.zoom);
        newDiagram.viewBox.pan({ x: $d.zoom.x, y: $d.zoom.y });
      }

      if ($d.guides && $d.guides.length > 0) {
        for (const guide of $d.guides) {
          newDiagram.addGuide(guide);
        }
      }

      dest.push(newDiagram);
    });

    if ($d.comments) {
      for (const serializedComment of $d.comments) {
        const comment = Comment.deserialize(serializedComment, newDiagram);

        if (comment.isStale()) {
          comment.staleSince ??= new Date();
          if (comment.staleSince.getTime() < Date.now() - 1000 * 60 * 60 * 24 * 30) {
            continue;
          }
        }

        newDiagram.commentManager.addComment(comment);
      }
    }

    deserializeDiagrams(doc, $d.diagrams, diagramFactory).forEach(d =>
      doc.addDiagram(d, newDiagram)
    );
  }

  return dest;
};

const deserializeOverrides = (
  db: DataManager,
  overrides: Record<string, Record<string, SerializedOverride>>
) => {
  const overridesCRDT = db.getOverrides();

  for (const [schemaId, schemaOverrides] of Object.entries(overrides)) {
    let schemaCRDT = overridesCRDT.get(schemaId);
    if (!schemaCRDT) {
      schemaCRDT = overridesCRDT.factory.makeMap<Record<string, SerializedOverride>>();
      overridesCRDT.set(schemaId, schemaCRDT);
    }

    for (const [uid, operation] of Object.entries(schemaOverrides)) {
      schemaCRDT.set(uid, operation);
    }
  }
};
