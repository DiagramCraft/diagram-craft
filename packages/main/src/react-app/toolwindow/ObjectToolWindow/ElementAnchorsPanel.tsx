import { ToolWindowPanel } from '../ToolWindowPanel';
import { useNodeProperty } from '../../hooks/useProperty';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { PropertyEditor } from '../../components/PropertyEditor';
import { useApplication, useDiagram } from '../../../application';
import { Button } from '@diagram-craft/app-components/Button';
import { newid } from '@diagram-craft/utils/id';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { useMemo } from 'react';
import { createThumbnailForNode } from '@diagram-craft/canvas-app/diagramThumbnail';
import { getAnchorPosition } from '@diagram-craft/model/anchor';
import { serializeDiagramElement } from '@diagram-craft/model/serialization/serialize';
import { deserializeDiagramElements } from '@diagram-craft/model/serialization/deserialize';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  StaticCanvasComponent,
  StaticCanvasProps
} from '@diagram-craft/canvas/canvas/StaticCanvasComponent';
import { Canvas } from '@diagram-craft/canvas-react/Canvas';
import type { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { ElementLookup } from '@diagram-craft/model/elementLookup';
import type { Property } from '@diagram-craft/model/property';

type CustomAnchorsEditorProps = {
  customAnchors: {
    val: Record<string, { x: number; y: number }> | undefined;
    set: (value: Record<string, { x: number; y: number }> | undefined) => void;
  };
  disabled: boolean;
  onChange: () => void;
  diagram: ReturnType<typeof useDiagram>;
};

const ShapePreviewWithAnchors = ({ diagram }: { diagram: ReturnType<typeof useDiagram> }) => {
  const application = useApplication();

  const selectedNode = useMemo(() => {
    return diagram.selection.nodes[0];
  }, [diagram.selection.nodes]);

  const previewDiagram = useMemo(() => {
    if (!selectedNode) return null;

    const { diagram: thumbnailDiagram, node: duplicatedNode } = createThumbnailForNode(
      (d, layer) => {
        const serializedNode = serializeDiagramElement(selectedNode);

        return UnitOfWork.execute(
          d,
          uow =>
            deserializeDiagramElements(
              [serializedNode],
              layer,
              uow,
              new ElementLookup<DiagramNode>(),
              new ElementLookup<DiagramEdge>()
            )[0] as DiagramNode
        );
      },
      diagram.document.definitions
    );

    const padding = 10;
    thumbnailDiagram.viewBox.dimensions = {
      w: duplicatedNode.bounds.w + padding,
      h: duplicatedNode.bounds.h + padding
    };
    thumbnailDiagram.viewBox.offset = {
      x: duplicatedNode.bounds.x - padding / 2,
      y: duplicatedNode.bounds.y - padding / 2
    };

    return thumbnailDiagram;
  }, [selectedNode, diagram.document.definitions]);

  if (!selectedNode || !previewDiagram) return null;

  const previewHeight = 120;
  const previewWidth = 120;
  const anchors = selectedNode.anchors;

  // Calculate the actual rendered size based on the diagram node's aspect ratio
  const nodeAspectRatio = selectedNode.bounds.w / selectedNode.bounds.h;
  const containerAspectRatio = previewWidth / previewHeight;

  let actualWidth: number;
  let actualHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (nodeAspectRatio > containerAspectRatio) {
    // Node is wider than container - fit to width
    actualWidth = previewWidth;
    actualHeight = previewWidth / nodeAspectRatio;
    offsetX = 0;
    offsetY = (previewHeight - actualHeight) / 2;
  } else {
    // Node is taller than container - fit to height
    actualWidth = previewHeight * nodeAspectRatio;
    actualHeight = previewHeight;
    offsetX = (previewWidth - actualWidth) / 2;
    offsetY = 0;
  }

  return (
    <div
      style={{
        width: previewWidth,
        height: previewHeight,
        borderRadius: '6px',
        background: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        padding: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}
    >
      <Canvas<StaticCanvasComponent, StaticCanvasProps>
        id={'preview-canvas'}
        context={application}
        width={'100%'}
        height={'100%'}
        className={''}
        onClick={() => {}}
        diagram={previewDiagram}
        viewbox={previewDiagram.viewBox.svgViewboxString}
        canvasFactory={() => new StaticCanvasComponent()}
      />

      {/* Anchor points overlay */}
      <svg
        width={previewWidth}
        height={previewHeight}
        style={{
          position: 'absolute',
          top: '0.5rem',
          left: '0.5rem',
          pointerEvents: 'none'
        }}
      >
        {anchors.map((anchor, index) => {
          const anchorPos = getAnchorPosition(selectedNode, anchor);
          const viewBox = previewDiagram.viewBox;

          // Convert world coordinates to actual rendered coordinates
          const svgX =
            ((anchorPos.x - viewBox.offset.x) / viewBox.dimensions.w) * actualWidth + offsetX;
          const svgY =
            ((anchorPos.y - viewBox.offset.y) / viewBox.dimensions.h) * actualHeight + offsetY;

          return (
            <circle
              key={anchor.id || index}
              cx={svgX}
              cy={svgY}
              r="4"
              fill={
                application.actions['TOGGLE_DARK_MODE']!.getState(undefined)
                  ? 'var(--accent-12)'
                  : 'var(--accent-3)'
              }
              stroke={'var(--accent-chroma)'}
              strokeWidth="1"
            />
          );
        })}
      </svg>
    </div>
  );
};

const CustomAnchorsEditor = ({
  customAnchors,
  disabled,
  onChange,
  diagram
}: CustomAnchorsEditorProps) => {
  return (
    <>
      <div className={'cmp-labeled-table__label util-a-top-center'} style={{ marginTop: '4px' }}>
        Anchors:
      </div>
      <div className={'cmp-labeled-table__value'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <ShapePreviewWithAnchors diagram={diagram} />
          {Object.entries(customAnchors.val ?? {}).map(
            ([id, anchor]: [string, { x: number; y: number }]) => (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                  <NumberInput
                    value={anchor.x ?? 0}
                    min={0}
                    max={1}
                    step={0.01}
                    label={'x'}
                    onChange={x => {
                      const newAnchors = { ...(customAnchors.val ?? {}) };
                      newAnchors[id] = {
                        ...newAnchors[id]!,
                        x: Math.max(0, Math.min(1, x ?? 0))
                      };
                      customAnchors.set(newAnchors);
                      onChange();
                    }}
                    style={{ width: '60px' }}
                    disabled={disabled}
                  />
                  <NumberInput
                    value={anchor.y ?? 0}
                    min={0}
                    max={1}
                    step={0.01}
                    label={'y'}
                    onChange={y => {
                      const newAnchors = { ...(customAnchors.val ?? {}) };
                      newAnchors[id] = {
                        ...newAnchors[id]!,
                        y: Math.max(0, Math.min(1, y ?? 0))
                      };
                      customAnchors.set(newAnchors);
                      onChange();
                    }}
                    style={{ width: '60px' }}
                    disabled={disabled}
                  />
                </div>
                <Button
                  type="icon-only"
                  onClick={() => {
                    const newAnchors = { ...(customAnchors.val ?? {}) };
                    delete newAnchors[id];
                    const isEmpty = Object.keys(newAnchors).length === 0;
                    customAnchors.set(isEmpty ? undefined : newAnchors);
                    onChange();
                  }}
                  disabled={disabled}
                >
                  <TbTrash />
                </Button>
              </div>
            )
          )}

          <Button
            type={'secondary'}
            onClick={() => {
              const id = newid();
              const newAnchors = { ...(customAnchors.val ?? {}) };
              newAnchors[id] = { x: 0.5, y: 0.5 };
              customAnchors.set(newAnchors);
            }}
            disabled={disabled}
            style={{ alignSelf: 'flex-start' }}
          >
            <span style={{ marginRight: '0.5rem' }}>
              <TbPlus />
            </span>{' '}
            Add Anchor
          </Button>
        </div>
      </div>
    </>
  );
};

export const ElementAnchorsPanel = (props: Props) => {
  const diagram = useDiagram();
  const type = useNodeProperty(diagram, 'anchors.type');
  const perEdge = useNodeProperty(diagram, 'anchors.perEdgeCount');
  const perPathCount = useNodeProperty(diagram, 'anchors.perPathCount');
  const directionsCount = useNodeProperty(diagram, 'anchors.directionsCount');
  const customAnchors = useNodeProperty(diagram, 'anchors.customAnchors', {});

  const disabled =
    !diagram.selection.isNodesOnly() ||
    diagram.selection.nodes.some(e => !e.getDefinition().supports('anchors-configurable'));

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="anchors"
      title={'Anchor Points'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Type:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor
            property={type as Property<string>}
            render={props => (
              <Select.Root {...props}>
                <Select.Item value={'none'}>No anchors</Select.Item>
                <Select.Item value={'shape-defaults'}>Default</Select.Item>
                <Select.Item value={'north-south'}>North/South</Select.Item>
                <Select.Item value={'east-west'}>East/West</Select.Item>
                <Select.Item value={'directions'}>x anchors (direction)</Select.Item>
                <Select.Item value={'per-path'}>x anchors (length)</Select.Item>
                <Select.Item value={'per-edge'}>x per edge</Select.Item>
                <Select.Item value={'custom'}>Custom</Select.Item>
              </Select.Root>
            )}
          />
        </div>

        {type.val !== 'custom' && (
          <>
            <div className={'cmp-labeled-table__label'}>Number:</div>
            <div className={'cmp-labeled-table__value'}>
              <NumberInput
                value={
                  type.val === 'per-edge'
                    ? perEdge.val
                    : type.val === 'directions'
                      ? directionsCount.val
                      : type.val === 'per-path'
                        ? perPathCount.val
                        : 0
                }
                disabled={
                  disabled ||
                  (type.val !== 'per-edge' && type.val !== 'directions' && type.val !== 'per-path')
                }
                onChange={v => {
                  if (type.val === 'per-edge') {
                    perEdge.set(v);
                  } else if (type.val === 'directions') {
                    directionsCount.set(v);
                  } else if (type.val === 'per-path') {
                    perPathCount.set(v);
                  }
                }}
              />
            </div>
          </>
        )}

        {type.val === 'custom' && (
          <CustomAnchorsEditor
            customAnchors={customAnchors}
            disabled={disabled}
            diagram={diagram}
            onChange={() => {
              const uow = new UnitOfWork(diagram, false);
              diagram.selection.nodes.forEach(node => {
                node.invalidateAnchors(uow);
              });
              uow.commit();
            }}
          />
        )}
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
