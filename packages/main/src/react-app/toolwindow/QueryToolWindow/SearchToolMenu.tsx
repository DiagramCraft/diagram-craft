import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TbChevronRight, TbDots } from 'react-icons/tb';
import type { QueryType } from '@diagram-craft/model/documentProps';
import { useApplication, useDocument } from '../../../application';
import { useCallback } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { RuleEditorDialogCommand } from '@diagram-craft/canvas-app/dialogs';
import { useToolWindowControls } from '../ToolWindow';
import { useQueryToolWindowContext } from './QueryToolWindowContext';
import { ElementSearchClause } from '@diagram-craft/model/diagramElementSearch';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import { RuleLayer } from '@diagram-craft/model/diagramLayerRule';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

type SearchToolMenuProps = {
  type: QueryType;
  onQuerySelect: (scope: string, query: string) => void;
  getLabel: () => string;
  getQuery: () => string;
  getScope: () => string;
};

export const SearchToolMenu = (props: SearchToolMenuProps) => {
  const application = useApplication();
  const redraw = useRedraw();
  const document = useDocument();
  const { switchTab } = useToolWindowControls();
  const { setDjqlQuery } = useQueryToolWindowContext();
  const history = document.props.query.history.filter(h => h.type === props.type);
  const saved = document.props.query.saved.filter(r => r.type === props.type);

  const saveSearch = useCallback(() => {
    application.ui.showDialog({
      id: 'stringInput',
      props: {
        title: 'Save search',
        value: props.getLabel(),
        description:
          'Enter a name for this search. This will be used to identify the search in the saved searches list.',
        label: 'Name',
        saveButtonLabel: 'Save',
        type: 'string'
      },
      onOk: value => {
        const query = props.getQuery();
        const scope = props.getScope();
        document.props.query.addSaved(props.type, value, scope, query);
        redraw();
      }
    });
  }, [props.getQuery]);

  const createRuleClausesFromSearch = useCallback((): ElementSearchClause[] => {
    const query = props.getQuery();

    switch (props.type) {
      case 'simple':
        if (!query.trim()) return [];
        return [
          {
            id: newid(),
            type: 'props',
            path: 'metadata.name',
            relation: 'contains',
            value: query
          }
        ];

      case 'djql':
        if (!query.trim()) return [];
        return [
          {
            id: newid(),
            type: 'query',
            query: query
          }
        ];

      case 'advanced':
        try {
          const parsedClauses = JSON.parse(query) as ElementSearchClause[];
          return parsedClauses
            .filter(c => c.type)
            .map(c => ({
              ...c,
              id: c.id ?? newid()
            }));
        } catch {
          return [];
        }

      default:
        return VERIFY_NOT_REACHED();
    }
  }, [props.type, props.getQuery]);

  const createRuleLayer = useCallback(() => {
    const clauses = createRuleClausesFromSearch();

    if (clauses.length === 0) {
      return;
    }

    const rule: AdjustmentRule = {
      id: newid(),
      name: `Rule from ${props.getLabel()}`,
      type: 'node',
      clauses: clauses,
      actions: []
    };

    application.ui.showDialog(
      new RuleEditorDialogCommand({ rule: rule }, (editedRule: AdjustmentRule) => {
        const diagram = application.model.activeDiagram;
        const uow = new UnitOfWork(diagram, true);

        const ruleLayer = new RuleLayer(newid(), editedRule.name, diagram, [editedRule]);
        diagram.layers.add(ruleLayer, uow);
        commitWithUndo(uow, 'Create rule layer');
      })
    );
  }, [createRuleClausesFromSearch, props.getLabel, application]);

  const convertSimpleSearchToDJQL = useCallback((query: string): string => {
    if (!query.trim()) return '.elements[]';

    const escapedQuery = query.replace(/"/g, '\\"');
    return `.elements[] | select(.type == "node") | select(.name | test("${escapedQuery}"; "i"))`;
  }, []);

  const convertAdvancedSearchToDJQL = useCallback((query: string): string => {
    if (!query.trim()) return '.elements[]';

    try {
      const parsedClauses = JSON.parse(query) as ElementSearchClause[];
      if (parsedClauses.length === 0) return '.elements[]';

      const filters: string[] = [];

      for (const clause of parsedClauses) {
        switch (clause.type) {
          case 'props':
            if (clause.relation === 'set') {
              filters.push(`select(.${clause.path} != null)`);
            } else {
              const value = clause.value;
              const path = clause.path;

              switch (clause.relation) {
                case 'eq': {
                  if (isNaN(Number(value))) {
                    filters.push(`select(.${path} == "${value}")`);
                  } else {
                    filters.push(`select(.${path} == ${value})`);
                  }
                  break;
                }
                case 'neq': {
                  if (isNaN(Number(value))) {
                    filters.push(`select(.${path} != "${value}")`);
                  } else {
                    filters.push(`select(.${path} != ${value})`);
                  }
                  break;
                }
                case 'gt':
                  filters.push(`select(.${path} > ${value})`);
                  break;
                case 'lt':
                  filters.push(`select(.${path} < ${value})`);
                  break;
                case 'contains': {
                  const escapedValue = value.replace(/"/g, '\\"');
                  filters.push(`select(.${path} | test("${escapedValue}"; "i"))`);
                  break;
                }
                case 'matches': {
                  const escapedRegex = value.replace(/"/g, '\\"');
                  filters.push(`select(.${path} | test("${escapedRegex}"))`);
                  break;
                }
              }
            }
            break;

          case 'tags':
            if (clause.tags && clause.tags.length > 0) {
              const tagsArray = JSON.stringify(clause.tags);
              filters.push(`select(.tags | contains(${tagsArray}))`);
            }
            break;

          case 'comment':
            if (clause.state) {
              filters.push(
                `select(.comments[] | select(.state == "${clause.state}") | length > 0)`
              );
            } else {
              filters.push(`select(.comments[] | length > 0)`);
            }
            break;

          case 'any':
            // For 'any' clauses, we would need recursive handling
            // For now, just add a placeholder that matches all elements
            filters.push('select(true)');
            break;
        }
      }

      return `.elements[] | ${filters.join(' | ')}`;
    } catch {
      return '.elements[]';
    }
  }, []);

  const convertToDJQL = useCallback(() => {
    const query = props.getQuery();
    const scope = props.getScope();

    let djqlQuery: string;

    switch (props.type) {
      case 'simple':
        djqlQuery = convertSimpleSearchToDJQL(query);
        break;
      case 'advanced':
        djqlQuery = convertAdvancedSearchToDJQL(query);
        break;
      default:
        return;
    }

    // Add the converted query to history
    document.props.query.addHistory('djql', djqlQuery, scope, djqlQuery);

    // Set the query in context so DJQL tab picks it up
    setDjqlQuery(djqlQuery, scope);

    // Switch to DJQL tab
    switchTab('djql');

    redraw();
  }, [props, convertSimpleSearchToDJQL, convertAdvancedSearchToDJQL, document, setDjqlQuery, switchTab, redraw]);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <a className={'cmp-button cmp-button--icon-only'}>
          <TbDots />
        </a>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="cmp-context-menu" align={'start'}>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger
              className="cmp-context-menu__item"
              disabled={history.length === 0}
            >
              Recent Searches
              <div className="cmp-context-menu__right-slot">
                <TbChevronRight />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="cmp-context-menu">
                {history.map(({ scope, value, label }) => (
                  <DropdownMenu.Item
                    key={value}
                    className="cmp-context-menu__item"
                    onClick={() => props.onQuerySelect(scope, value)}
                  >
                    {label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator className="cmp-context-menu__separator" />
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger
              className="cmp-context-menu__item"
              disabled={saved.length === 0}
            >
              Saved Searches
              <div className="cmp-context-menu__right-slot">
                <TbChevronRight />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="cmp-context-menu">
                {saved.map(({ scope, value, label }) => (
                  <DropdownMenu.Item
                    key={value}
                    className="cmp-context-menu__item"
                    onClick={() => props.onQuerySelect(scope, value)}
                  >
                    {label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Item className="cmp-context-menu__item" onClick={saveSearch}>
            Save Search
          </DropdownMenu.Item>
          <DropdownMenu.Item className="cmp-context-menu__item">
            Manage Saved Searches
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="cmp-context-menu__separator" />
          {props.type !== 'djql' && (
            <DropdownMenu.Item className="cmp-context-menu__item" onClick={convertToDJQL}>
              Convert to DJQL
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item className="cmp-context-menu__item" onClick={createRuleLayer}>
            Create Rule Layer
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
