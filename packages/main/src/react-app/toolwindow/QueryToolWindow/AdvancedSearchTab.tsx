import { useState } from 'react';
import styles from './AdvancedSearchTab.module.css';
import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import {
  clausesToString,
  ElementSearchClause,
  searchByElementSearchClauses
} from '@diagram-craft/model/diagramElementSearch';
import { validProps } from '@diagram-craft/model/diagramLayerRule';
import { newid } from '@diagram-craft/utils/id';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TagInput } from '@diagram-craft/app-components/TagInput';
import { TreeSelect } from '@diagram-craft/app-components/TreeSelect';
import { Button } from '@diagram-craft/app-components/Button';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { TbPlus, TbSearch, TbTrash } from 'react-icons/tb';
import { SearchResultsPanel } from './SearchResultsPanel';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { ToolWindow } from '../ToolWindow';
import { SearchToolMenu } from './SearchToolMenu';

type SearchScope = 'active-layer' | 'active-diagram' | 'active-document';

type EditableElementSearchClause = Partial<ElementSearchClause>;

type ClauseListProps = {
  clauses: EditableElementSearchClause[];
  onChange: (newClauses: EditableElementSearchClause[]) => void;
  type: 'edge' | 'node';
  subClauses?: boolean;
};

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

const AdvancedSearchClauseList = (props: ClauseListProps) => {
  const diagram = useDiagram();

  return (
    <>
      {props.clauses.map((c, idx) => {
        return (
          <div key={c.id} className={styles.advancedSearchClause}>
            <div className={styles.advancedSearchClause__select}>
              <Select.Root
                value={c.type ?? ''}
                placeholder={'Select Rule'}
                onChange={t => {
                  const newClauses = [...props.clauses];
                  // @ts-ignore
                  newClauses[idx].type = t;
                  props.onChange(newClauses);
                }}
              >
                <Select.Item value={'props'}>Property</Select.Item>
                <Select.Item value={'tags'}>Tags</Select.Item>
                <Select.Item value={'comment'}>Comment</Select.Item>
                {!props.subClauses && <Select.Item value={'any'}>Any</Select.Item>}
              </Select.Root>
            </div>

            <div className={styles.advancedSearchClause__props}>
              {c.type === 'props' && (
                <div className={styles.advancedSearchClause__propsColumn}>
                  <TreeSelect.Root
                    value={c.path ?? ''}
                    onValueChange={v => {
                      c.path = v;
                      c.relation ??= 'eq';
                      props.onChange([...props.clauses]);
                    }}
                    items={validProps(props.type)}
                    placeholder={'Select property'}
                  />
                  <Select.Root
                    value={c.relation ?? 'eq'}
                    onChange={cond => {
                      // @ts-ignore
                      c.relation = cond;
                      props.onChange([...props.clauses]);
                    }}
                  >
                    <Select.Item value={'eq'}>Is</Select.Item>
                    <Select.Item value={'neq'}>Is Not</Select.Item>
                    <Select.Item value={'contains'}>Contains</Select.Item>
                    <Select.Item value={'matches'}>Matches</Select.Item>
                    <Select.Item value={'gt'}>Greater Than</Select.Item>
                    <Select.Item value={'lt'}>Less Than</Select.Item>
                    <Select.Item value={'set'}>Is Set</Select.Item>
                  </Select.Root>
                  {c.relation !== 'set' && (
                    <TextInput
                      value={c.value ?? ''}
                      onChange={v => {
                        c.value = v;
                        c.relation ??= 'eq';
                        props.onChange([...props.clauses]);
                      }}
                    />
                  )}
                </div>
              )}

              {c.type === 'tags' && (
                <TagInput
                  selectedTags={c.tags || []}
                  availableTags={[...diagram.document.tags.tags]}
                  onTagsChange={newTags => {
                    const newClauses = [...props.clauses];
                    // @ts-ignore
                    newClauses[idx].tags = newTags;
                    props.onChange(newClauses);
                  }}
                  placeholder="Select tags..."
                />
              )}

              {c.type === 'comment' && (
                <Select.Root
                  value={c.state ?? 'any'}
                  placeholder={'Any comment state'}
                  onChange={state => {
                    const newClauses = [...props.clauses];
                    // @ts-ignore
                    newClauses[idx].state = state === 'any' ? undefined : state;
                    props.onChange(newClauses);
                  }}
                >
                  <Select.Item value={'any'}>Any</Select.Item>
                  <Select.Item value={'unresolved'}>Unresolved</Select.Item>
                  <Select.Item value={'resolved'}>Resolved</Select.Item>
                </Select.Root>
              )}
            </div>

            <div className={styles.advancedSearchClause__props}>
              {c.type === 'any' && (
                <div className={styles.advancedSearchClause__subClause}>
                  <AdvancedSearchClauseList
                    clauses={c.clauses ?? [{ id: newid() }]}
                    onChange={newClauses => {
                      c.clauses = newClauses as ElementSearchClause[];
                      props.onChange([...props.clauses]);
                    }}
                    type={props.type}
                    subClauses={true}
                  />
                </div>
              )}
            </div>

            <div className={styles.advancedSearchClause__buttons}>
              <Button
                type={'icon-only'}
                onClick={() => {
                  const newClauses = props.clauses.toSpliced(idx + 1, 0, {
                    id: newid()
                  });
                  props.onChange(newClauses);
                }}
              >
                <TbPlus />
              </Button>
              <Button
                type={'icon-only'}
                disabled={idx === 0 && props.clauses.length === 1}
                onClick={() => {
                  const newClauses = props.clauses.toSpliced(idx, 1);
                  props.onChange(newClauses);
                }}
              >
                <TbTrash />
              </Button>
            </div>

            <div className={styles.advancedSearchClause__indent}></div>
          </div>
        );
      })}
    </>
  );
};

export const AdvancedSearchTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const [type, setType] = useState<'edge' | 'node'>('node');
  const [scope, setScope] = useState<SearchScope>('active-diagram');
  const [clauses, setClauses] = useState<EditableElementSearchClause[]>([{ id: newid() }]);
  const [results, setResults] = useState<DiagramElement[]>([]);

  const executeSearch = () => {
    const elements = getElementsFromScope(scope, diagram);

    // Filter out incomplete clauses and convert to complete ElementSearchClause
    const validClauses: ElementSearchClause[] = clauses
      .filter(c => c.type) // Must have a type
      .map(
        c =>
          ({
            id: c.id || newid(),
            type: c.type!,
            ...c
          }) as ElementSearchClause
      );

    if (validClauses.length === 0) {
      setResults([]);
      return;
    }

    try {
      const searchResults = searchByElementSearchClauses(diagram, validClauses);
      const intersection = searchResults.reduce((p, c) => p.intersection(c), searchResults[0]);
      const matchedElements = elements.filter(e => intersection.has(e.id));
      setResults(matchedElements);

      diagram.document.props.query.addHistory(
        'advanced',
        clausesToString(clauses as Array<ElementSearchClause>),
        scope,
        JSON.stringify(clauses)
      );
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    }
  };

  const handleElementClick = (element: DiagramElement) => {
    // Select the element
    diagram.selectionState.clear();
    diagram.selectionState.setElements([element]);

    // Focus on the element by centering it in the viewport if possible
    redraw();
  };

  return (
    <ToolWindow.TabContent>
      <ToolWindow.TabActions>
        <SearchToolMenu
          type={'advanced'}
          getQuery={() => JSON.stringify(clauses)}
          getScope={() => scope}
          getLabel={() => clausesToString(clauses as Array<ElementSearchClause>)}
          onQuerySelect={(scope, query) => {
            setScope(scope as SearchScope);
            setClauses(JSON.parse(query) as EditableElementSearchClause[]);
          }}
        />
      </ToolWindow.TabActions>
      <Accordion.Root type="multiple" defaultValue={['advanced-search-criteria', 'search-results']}>
        <ToolWindowPanel mode="headless" id="advanced-search-criteria" title="Search Criteria">
          <div className={styles.advancedSearch__container}>
            <div className={styles.advancedSearch__header}>
              <ToggleButtonGroup.Root
                type="single"
                value={type}
                onChange={value => {
                  if (value) setType(value as 'edge' | 'node');
                }}
              >
                <ToggleButtonGroup.Item value="node">Nodes</ToggleButtonGroup.Item>
                <ToggleButtonGroup.Item value="edge">Edges</ToggleButtonGroup.Item>
              </ToggleButtonGroup.Root>

              <Select.Root
                value={scope}
                onChange={value => setScope((value ?? 'active-diagram') as SearchScope)}
              >
                <Select.Item value="active-layer">Active Layer</Select.Item>
                <Select.Item value="active-diagram">Active Diagram</Select.Item>
                <Select.Item value="active-document">Active Document</Select.Item>
              </Select.Root>
            </div>

            <div className={styles.advancedSearch__criteria}>
              <AdvancedSearchClauseList
                clauses={clauses}
                onChange={setClauses}
                subClauses={false}
                type={type}
              />
            </div>

            <Button
              type="primary"
              onClick={executeSearch}
              className={styles.advancedSearch__searchButton}
            >
              <TbSearch />
              Search
            </Button>
          </div>
        </ToolWindowPanel>

        <SearchResultsPanel
          results={results}
          searchText={`Found ${results.length} elements`}
          onElementClick={handleElementClick}
        />
      </Accordion.Root>
    </ToolWindow.TabContent>
  );
};
