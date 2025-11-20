import styles from './RuleEditorDialog.module.css';
import { useDiagram } from '../../../application';
import {
  jsonHighlighter,
  SyntaxHighlightingEditor
} from '@diagram-craft/app-components/SyntaxHighlightingEditor';
import { Select } from '@diagram-craft/app-components/Select';
import { validProps } from '@diagram-craft/model/diagramLayerRule';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { MultiSelect } from '@diagram-craft/app-components/MultiSelect';
import { TreeSelect } from '@diagram-craft/app-components/TreeSelect';
import { Button } from '@diagram-craft/app-components/Button';
import { newid } from '@diagram-craft/utils/id';
import { TbPlus, TbTrash } from 'react-icons/tb';
import type { EditableElementSearchClause } from './RuleEditorDialog';
import type { ElementSearchClause } from '@diagram-craft/model/diagramElementSearch';

export const ClauseList = (props: ClauseListProps) => {
  const diagram = useDiagram();

  return (
    <>
      {props.clauses.map((c, idx) => {
        return (
          <div key={c.id} className={styles.ruleEditor__clause}>
            <div className={styles.ruleEditorClause__select}>
              <Select.Root
                value={c.type ?? ''}
                placeholder={'Select Rule'}
                onChange={t => {
                  const newClauses = [...props.clauses];
                  // @ts-expect-error
                  newClauses[idx].type = t;
                  props.onChange(newClauses);
                }}
              >
                <Select.Item value={'query'}>Query</Select.Item>
                <Select.Item value={'props'}>Property</Select.Item>
                <Select.Item value={'tags'}>Tags</Select.Item>
                <Select.Item value={'comment'}>Comment</Select.Item>
                {!props.subClauses && <Select.Item value={'any'}>Any</Select.Item>}
              </Select.Root>
            </div>

            <div className={styles.ruleEditorClause__props}>
              {c.type === 'query' && (
                <SyntaxHighlightingEditor
                  highlighter={jsonHighlighter}
                  rows={3}
                  className={styles.ruleEditorClause__queryTextArea}
                  defaultValue={c.query ?? ''}
                  onKeyDown={e => {
                    // TODO: Why is this needed?
                    e.stopPropagation();
                  }}
                  onChange={e => {
                    const newClauses = [...props.clauses];
                    // @ts-expect-error
                    newClauses[idx].query = e.target.value;
                    props.onChange(newClauses);
                  }}
                />
              )}
              {c.type === 'any' && (
                <div className={styles.ruleEditorClause__anyContainer}>
                  <div className={styles.ruleEditorClause__anyLine}></div>
                </div>
              )}
              {c.type === 'props' && (
                <div className={styles.ruleEditorClause__propsRow}>
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
                  {/* TODO: Filter relations based on type */}
                  <Select.Root
                    value={'eq'}
                    onChange={cond => {
                      // @ts-expect-error
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
                  </Select.Root>
                  <TextInput
                    value={c.value ?? ''}
                    onChange={v => {
                      c.value = v;
                      c.relation ??= 'eq';
                      props.onChange([...props.clauses]);
                    }}
                  />
                </div>
              )}
              {c.type === 'tags' && (
                <MultiSelect
                  selectedValues={c.tags || []}
                  availableItems={[...diagram.document.tags.tags].map(tag => ({
                    value: tag,
                    label: tag
                  }))}
                  onSelectionChange={newTags => {
                    const newClauses = [...props.clauses];
                    // @ts-expect-error
                    newClauses[idx].tags = newTags;
                    props.onChange(newClauses);
                  }}
                  allowCustomValues={true}
                  placeholder="Select tags..."
                />
              )}
              {c.type === 'comment' && (
                <Select.Root
                  value={c.state ?? 'any'}
                  placeholder={'Any comment state'}
                  onChange={state => {
                    const newClauses = [...props.clauses];
                    // @ts-expect-error
                    newClauses[idx].state = state === 'any' ? undefined : state;
                    props.onChange(newClauses);
                  }}
                >
                  <Select.Item value={'any'}>Any</Select.Item>
                  <Select.Item value={'unresolved'}>Unresolved</Select.Item>
                  <Select.Item value={'resolved'}>Resolved</Select.Item>
                </Select.Root>
              )}
              {c.type !== 'query' &&
                c.type !== 'any' &&
                c.type !== 'props' &&
                c.type !== 'tags' &&
                c.type !== 'comment' && <div></div>}
            </div>

            <div className={styles.ruleEditorClause__buttons}>
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

            {c.type === 'any' && (
              <div className={styles.ruleEditor__subClause}>
                <ClauseList
                  clauses={c.clauses ?? [{ id: newid() }]}
                  onChange={newClauses => {
                    c.clauses = newClauses as ElementSearchClause[];
                    // Note: the clone here is to force rerender
                    props.onChange([...props.clauses]);
                  }}
                  subClauses={true}
                  type={props.type}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

type ClauseListProps = {
  clauses: EditableElementSearchClause[];
  onChange: (newClauses: EditableElementSearchClause[]) => void;
  subClauses: boolean;
  type: 'edge' | 'node';
};
