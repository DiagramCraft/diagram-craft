import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useState } from 'react';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { searchByText } from '@diagram-craft/model/diagramElementSearch';
import { SearchPanel } from './SearchPanel';
import { SearchResultsPanel } from './SearchResultsPanel';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { SearchToolMenu } from './SearchToolMenu';
import { ToolWindow } from '../ToolWindow';

type SearchScope = 'active-layer' | 'active-diagram' | 'active-document';

const getElementsFromScope = (scope: SearchScope, diagram: Diagram): DiagramElement[] => {
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
  const [scope, setScope] = useState<SearchScope>('active-diagram');

  const elements = getElementsFromScope(scope, diagram);
  const results: DiagramElement[] = searchByText(elements, searchQuery);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setInputText(text);
    diagram.document.props.query.addHistory('simple', text, scope, text);
  };

  const handleElementClick = (element: DiagramElement) => {
    // Select the element
    diagram.selection.clear();
    diagram.selection.setElements([element]);

    // Focus on the element by centering it in the viewport if possible
    redraw();
  };

  return (
    <>
      <ToolWindow.TabActions>
        <SearchToolMenu
          type={'simple'}
          getLabel={() => searchQuery}
          getQuery={() => searchQuery}
          getScope={() => scope}
          onQuerySelect={(scope, query) => {
            setScope(scope as SearchScope);
            setSearchQuery(query);
            setInputText(query);
          }}
        />
      </ToolWindow.TabActions>
      <ToolWindow.TabContent>
        <Accordion.Root type="multiple" defaultValue={['search-input', 'search-results']}>
          <SearchPanel
            searchText={inputText}
            onSearchTextChange={text => {
              setInputText(text);
              // Only clear search results when text is completely cleared
              if (!text.trim()) {
                setSearchQuery('');
              }
            }}
            onSearch={handleSearch}
            scope={scope}
            onScopeChange={(value: string) => setScope(value as SearchScope)}
          />
          <SearchResultsPanel
            results={results}
            searchText={searchQuery}
            onElementClick={handleElementClick}
          />
        </Accordion.Root>
      </ToolWindow.TabContent>
    </>
  );
};
