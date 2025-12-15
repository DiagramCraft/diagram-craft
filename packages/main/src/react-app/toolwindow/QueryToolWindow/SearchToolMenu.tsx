import { TbDots } from 'react-icons/tb';
import type { QueryType } from '@diagram-craft/model/documentProps';
import { useApplication, useDocument } from '../../../application';
import { useCallback, useState } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { RuleEditorDialogCommand } from '@diagram-craft/canvas-app/dialogs';
import { useToolWindowControls } from '../ToolWindow';
import { useQueryToolWindowContext } from './QueryToolWindowContext';
import { ElementSearchClause } from '@diagram-craft/model/diagramElementSearch';
import { convertAdvancedSearchToDJQL, convertSimpleSearchToDJQL } from './djqlConverter';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import { RuleLayer } from '@diagram-craft/model/diagramLayerRule';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { ManageSavedSearchesDialog } from './ManageSavedSearchesDialog';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';

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
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

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
  }, [props.getQuery, application, document, props, redraw]);

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
        return VERIFY_NOT_REACHED();
    }

    document.props.query.addHistory('djql', djqlQuery, scope, djqlQuery);
    setDjqlQuery(djqlQuery, scope);
    switchTab('djql');
  }, [props, document, setDjqlQuery, switchTab]);

  return (
    <MenuButton.Root>
      <MenuButton.Trigger type={'icon-only'}>
        <TbDots />
      </MenuButton.Trigger>
      <MenuButton.Menu>
        <Menu.SubMenu disabled={history.length === 0} label={'Recent Searches'}>
          {history.map(({ scope, value, label }) => (
            <Menu.Item key={value} onClick={() => props.onQuerySelect(scope, value)}>
              {label}
            </Menu.Item>
          ))}
        </Menu.SubMenu>
        <Menu.Separator />
        <Menu.SubMenu label={'Saved Searches'} disabled={saved.length === 0}>
          {saved.map(({ scope, value, label }) => (
            <Menu.Item key={value} onClick={() => props.onQuerySelect(scope, value)}>
              {label}
            </Menu.Item>
          ))}
        </Menu.SubMenu>
        <Menu.Item onClick={saveSearch}>Save Search</Menu.Item>
        <Menu.Item onClick={() => setIsManageDialogOpen(true)}>Manage Saved Searches</Menu.Item>
        <Menu.Separator />
        {props.type !== 'djql' && <Menu.Item onClick={convertToDJQL}>Convert to DJQL</Menu.Item>}
        <Menu.Item onClick={createRuleLayer}>Create Rule Layer</Menu.Item>
      </MenuButton.Menu>

      <ManageSavedSearchesDialog
        open={isManageDialogOpen}
        onClose={() => setIsManageDialogOpen(false)}
        initialSearchType={props.type}
      />
    </MenuButton.Root>
  );
};
