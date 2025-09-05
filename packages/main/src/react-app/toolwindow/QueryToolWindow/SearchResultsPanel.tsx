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

type SearchResult = {
  element: DiagramElement;
  text: string;
  type: 'node' | 'edge';
};

type SearchResultsPanelProps = {
  results: SearchResult[];
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
        {results.map(r => (
          <div
            key={r.element.id}
            className={styles.searchResult}
            onClick={() => onElementClick(r.element)}
          >
            <div>
              <span className={styles.searchResultIcon}>{getElementIcon(r.element)}</span>
              <span className={styles.searchResultText}>
                {r.element.name || `${r.element.id.substring(0, 8)}...`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ToolWindowPanel>
  );
};
