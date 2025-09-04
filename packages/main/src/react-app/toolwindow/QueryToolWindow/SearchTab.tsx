import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useState } from 'react';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { SearchPanel } from './SearchPanel';
import { SearchResultsPanel } from './SearchResultsPanel';
import { Accordion } from '@diagram-craft/app-components/Accordion';

type SearchResult = {
  element: DiagramElement;
  text: string;
  type: 'node' | 'edge';
};

const getElementsFromScope = (scope: string, diagram: Diagram): DiagramElement[] => {
  switch (scope) {
    case 'active-layer':
      return Array.from((diagram.activeLayer as RegularLayer).elements);
    case 'active-diagram':
      return diagram.layers.all
        .filter((layer): layer is RegularLayer => layer.type === 'regular')
        .flatMap(layer => Array.from(layer.elements));
    case 'active-document':
      return diagram.document.diagrams.flatMap(d => 
        d.layers.all
          .filter((layer): layer is RegularLayer => layer.type === 'regular')
          .flatMap(layer => Array.from(layer.elements))
      );
    default:
      return Array.from((diagram.activeLayer as RegularLayer).elements);
  }
};

export const SearchTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<string>('active-layer');
  
  const searchElements = (): SearchResult[] => {
    if (!searchQuery.trim()) return [];
    
    const results: SearchResult[] = [];
    const searchLower = searchQuery.toLowerCase();
    const elements = getElementsFromScope(scope, diagram);
    
    elements.forEach(element => {
      if (isNode(element)) {
        const text = element.getText();
        if (text && text.toLowerCase().includes(searchLower)) {
          results.push({
            element,
            text,
            type: 'node'
          });
        }
      }
    });
    
    return results;
  };

  const results = searchElements();

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setInputText(text);
  };

  const handleElementClick = (element: DiagramElement) => {
    // Select the element
    diagram.selectionState.clear();
    diagram.selectionState.setElements([element]);
    
    // Focus on the element by centering it in the viewport if possible
    redraw();
  };

  return (
    <Accordion.Root type="multiple" defaultValue={['search-input', 'search-results']}>
      <SearchPanel 
        searchText={inputText} 
        onSearchTextChange={(text) => {
          setInputText(text);
          // Only clear search results when text is completely cleared
          if (!text.trim()) {
            setSearchQuery('');
          }
        }}
        onSearch={handleSearch}
        scope={scope}
        onScopeChange={setScope}
      />
      <SearchResultsPanel 
        results={results}
        searchText={searchQuery}
        onElementClick={handleElementClick}
      />
    </Accordion.Root>
  );
};