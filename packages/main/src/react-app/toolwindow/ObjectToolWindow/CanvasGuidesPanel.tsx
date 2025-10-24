import { useRef } from 'react';
import { TbPlus, TbSeparatorHorizontal, TbSeparatorVertical, TbTrash } from 'react-icons/tb';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useDiagram } from '../../../application';
import { useEventListener } from '../../hooks/useEventListener';
import { useRedraw } from '../../hooks/useRedraw';
import { ColorPicker } from '../../components/ColorPicker';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Button } from '@diagram-craft/app-components/Button';
import { useConfiguration } from '../../context/ConfigurationContext';
import {
  CreateGuideUndoableAction,
  DEFAULT_GUIDE_COLOR,
  DeleteGuideUndoableAction,
  EditGuideUndoableAction,
  type Guide,
  MoveGuideUndoableAction
} from '@diagram-craft/model/guides';

const SECTION_LABEL_COLOR = 'var(--base-fg-more-dim)';

interface GuideRowProps {
  guide: Guide;
}

const GuideRow = (props: GuideRowProps) => {
  const { guide } = props;
  const diagram = useDiagram();
  const $cfg = useConfiguration();

  const handleTypeToggle = () => {
    const newType = guide.type === 'horizontal' ? 'vertical' : 'horizontal';

    diagram.undoManager.addAndExecute(
      new EditGuideUndoableAction(diagram, guide, { type: guide.type }, { type: newType })
    );
  };

  const handlePositionChange = (n: number | undefined) => {
    const newPosition = n ?? 0;
    if (newPosition === guide.position) return;

    diagram.undoManager.addAndExecute(
      new MoveGuideUndoableAction(diagram, guide, guide.position, newPosition)
    );
  };

  const handleColorChange = (color: string | undefined) => {
    const newColor = color ?? DEFAULT_GUIDE_COLOR;
    if (newColor === guide.color) return;

    diagram.undoManager.addAndExecute(
      new EditGuideUndoableAction(diagram, guide, { color: guide.color }, { color: newColor })
    );
  };

  const handleRemove = () => {
    diagram.undoManager.addAndExecute(new DeleteGuideUndoableAction(diagram, guide));
  };

  return (
    <div
      key={guide.id}
      className="util-vcenter util-hstack"
      style={{ gap: '4px', padding: '2px 2px' }}
    >
      <Button
        type={'secondary'}
        onClick={handleTypeToggle}
        title={`Change to ${guide.type === 'horizontal' ? 'vertical' : 'horizontal'} guide`}
      >
        {guide.type === 'horizontal' ? <TbSeparatorHorizontal /> : <TbSeparatorVertical />}
      </Button>
      <NumberInput
        style={{ width: '60px' }}
        value={guide.position}
        onChange={handlePositionChange}
        defaultUnit={'px'}
      />
      <ColorPicker
        palette={$cfg.palette.primary}
        value={guide.color ?? DEFAULT_GUIDE_COLOR}
        onChange={handleColorChange}
        customPalette={diagram.document.customPalette}
        onChangeCustomPalette={(idx, v) => diagram.document.customPalette.setColor(idx, v)}
      />
      <div style={{ marginLeft: 'auto' }}>
        <Button type="icon-only" onClick={handleRemove} title="Remove guide">
          <TbTrash />
        </Button>
      </div>
    </div>
  );
};

export const CanvasGuidesPanel = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEventListener(diagram, 'diagramChange', redraw);

  const addGuide = () => {
    const existingGuides = [...diagram.guides];
    let newGuide: Guide;

    if (existingGuides.length === 0) {
      // First guide: vertical at center of canvas
      const centerX = diagram.canvas.x + diagram.canvas.w / 2;
      newGuide = diagram.addGuide({
        type: 'vertical',
        position: centerX,
        color: DEFAULT_GUIDE_COLOR
      });
    } else {
      // Use the last guide as reference
      const lastGuide = existingGuides[existingGuides.length - 1]!;
      newGuide = diagram.addGuide({
        type: lastGuide.type,
        position: lastGuide.position + 100,
        color: lastGuide.color ?? DEFAULT_GUIDE_COLOR
      });
    }

    // Add to undo history
    if (newGuide) {
      diagram.undoManager.add(new CreateGuideUndoableAction(diagram, newGuide));
    }

    // Scroll to bottom after adding
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 0);
  };

  const sortedGuides = [...diagram.guides].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'horizontal' ? -1 : 1;
    return a.position - b.position;
  });

  const horizontalGuides = sortedGuides.filter(g => g.type === 'horizontal');
  const verticalGuides = sortedGuides.filter(g => g.type === 'vertical');

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} title={'Guides'} id={'guides'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
        {/* Guides List */}
        {diagram.guides.length > 0 && (
          <div
            ref={scrollContainerRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: '25vh',
              overflowY: 'auto',
              paddingRight: '10px'
            }}
          >
            {horizontalGuides.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: '0.85em',
                    color: SECTION_LABEL_COLOR,
                    marginTop: '2px',
                    marginBottom: '4px'
                  }}
                >
                  Horizontal
                </div>

                {horizontalGuides.map((guide: Guide) => (
                  <GuideRow key={guide.id} guide={guide} />
                ))}
              </>
            )}

            {verticalGuides.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: '0.85em',
                    color: SECTION_LABEL_COLOR,
                    marginTop: horizontalGuides.length > 0 ? '12px' : '2px',
                    marginBottom: '4px'
                  }}
                >
                  Vertical
                </div>

                {verticalGuides.map((guide: Guide) => (
                  <GuideRow key={guide.id} guide={guide} />
                ))}
              </>
            )}
          </div>
        )}

        {diagram.guides.length === 0 && (
          <div
            style={{
              color: SECTION_LABEL_COLOR,
              fontSize: '0.9em',
              textAlign: 'left',
              padding: '2px 0'
            }}
          >
            Click the Add button below to add your first guide.
          </div>
        )}

        <div style={{ marginTop: '8px' }}>
          <Button
            type="primary"
            onClick={addGuide}
            title={'Add Guide'}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <TbPlus />
            <span>Add</span>
          </Button>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
