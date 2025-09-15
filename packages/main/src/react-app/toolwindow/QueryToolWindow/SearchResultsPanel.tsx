import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { ToolWindowPanel } from '../ToolWindowPanel';
import {
  TbLine,
  TbRectangle,
  TbBoxMultiple,
  TbTable,
  TbTextSize,
  TbTableRow,
  TbGridDots
} from 'react-icons/tb';
import styles from './SearchResultsPanel.module.css';
import { addHighlight, Highlights, removeHighlight } from '@diagram-craft/canvas/highlight';
import { ElementPreview } from './ElementPreview';
import { useState } from 'react';

type SearchResultsPanelProps = {
  results: DiagramElement[];
  searchText: string;
  onElementClick: (element: DiagramElement) => void;
};

type ViewMode = 'text' | 'preview';

const getElementIcon = (element: DiagramElement) => {
  if (isEdge(element)) {
    return <TbLine />;
  } else if (isNode(element)) {
    switch (element.nodeType) {
      case 'group':
        return <TbBoxMultiple />;
      case 'table':
        return <TbTable />;
      case 'text':
        return <TbTextSize />;
      case 'tableRow':
        return <TbTableRow />;
      default:
        return <TbRectangle />;
    }
  }
  return <TbRectangle />;
};

export const SearchResultsPanel = ({
  results,
  searchText,
  onElementClick
}: SearchResultsPanelProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('text');

  return (
    <ToolWindowPanel
      mode={'accordion'}
      id={'search-results'}
      title={'Search Results'}
      headerButtons={
        results.length > 0 ? (
          <a
            onClick={() => setViewMode(viewMode === 'text' ? 'preview' : 'text')}
            style={{
              color: viewMode === 'preview' ? 'var(--accent-fg)' : 'var(--base-fg-more-dim'
            }}
            title={viewMode === 'text' ? 'Switch to preview mode' : 'Switch to text mode'}
          >
            <TbGridDots size={12} />
          </a>
        ) : undefined
      }
    >
      {(results.length === 0 || searchText.trim() === '') && (
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '0.5rem' }}>
          {results.length > 0
            ? `${results.length} result${results.length !== 1 ? 's' : ''}`
            : searchText.trim()
              ? 'No results found'
              : 'Enter text to search'}
        </div>
      )}

      {viewMode === 'text' ? (
        <div className={styles.searchResultList}>
          {results.map(element => (
            <div
              key={element.id}
              className={styles.searchResult}
              onClick={() => onElementClick(element)}
              onMouseEnter={() => {
                addHighlight(element, Highlights.NODE__HIGHLIGHT);
              }}
              onMouseLeave={() => {
                removeHighlight(element, Highlights.NODE__HIGHLIGHT);
              }}
            >
              <div>
                <span className={styles.searchResultIcon}>{getElementIcon(element)}</span>
                <span className={styles.searchResultText}>
                  {element.name || `${element.id.substring(0, 8)}...`}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.searchResultGrid + ' light-theme'}>
          {results.map(element => (
            <div
              key={element.id}
              className={styles.searchResultPreview}
              onClick={() => onElementClick(element)}
              onMouseEnter={() => addHighlight(element, Highlights.NODE__HIGHLIGHT)}
              onMouseLeave={() => removeHighlight(element, Highlights.NODE__HIGHLIGHT)}
              title={element.name || `Element ${element.id.substring(0, 8)}...`}
            >
              <ElementPreview element={element} size={32} />
            </div>
          ))}
        </div>
      )}
    </ToolWindowPanel>
  );
};
