import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { ToolWindowPanel } from '../ToolWindowPanel';
import {
  TbLine,
  TbRectangle,
  TbBoxMultiple,
  TbTable,
  TbTextSize,
  TbTableRow
} from 'react-icons/tb';
import styles from './SearchResultsPanel.module.css';
import { addHighlight, Highlights, removeHighlight } from '@diagram-craft/canvas/highlight';


type SearchResultsPanelProps = {
  results: DiagramElement[];
  searchText: string;
  onElementClick: (element: DiagramElement) => void;
};

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
  return (
    <ToolWindowPanel mode={'accordion'} id={'search-results'} title={'Search Results'}>
      {results.length === 0 && (
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '0.5rem' }}>
          {searchText.trim() ? 'No results found' : 'Enter text to search'}
        </div>
      )}

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
    </ToolWindowPanel>
  );
};
