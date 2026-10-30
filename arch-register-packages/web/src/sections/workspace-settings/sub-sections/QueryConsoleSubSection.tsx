import { useState } from 'react';
import type { EntityQueryParseError } from '@arch-register/api-types/entityContract';
import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { useParseEntityQueryText, useRunEntityQuery } from '../../../hooks/useEntityQueryText';
import { SettingsBlock, SettingsBlockField } from '../SettingsBlock';
import styles from './QueryConsoleSubSection.module.css';

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The query could not be executed.';

export const QueryConsoleSubSection = ({ workspaceId }: { workspaceId: string }) => {
  const [queryText, setQueryText] = useState('');
  const [parseErrors, setParseErrors] = useState<EntityQueryParseError[]>([]);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [result, setResult] = useState<{ raw: string; total: number } | null>(null);
  const parseQuery = useParseEntityQueryText(workspaceId);
  const runQuery = useRunEntityQuery(workspaceId);

  const isPending = parseQuery.isPending || runQuery.isPending;
  const canRun = queryText.trim() !== '' && !isPending;

  const handleQueryChange = (value: string | undefined) => {
    setQueryText(value ?? '');
    setParseErrors([]);
    setExecutionError(null);
  };

  const run = async () => {
    const text = queryText.trim();
    if (text === '') return;

    setParseErrors([]);
    setExecutionError(null);
    setResult(null);

    try {
      const parsed = await parseQuery.mutateAsync(text);
      if (!parsed.ok) {
        setParseErrors(parsed.errors);
        return;
      }

      const response = await runQuery.mutateAsync(parsed.query);
      setResult({ raw: JSON.stringify(response.items, null, 2), total: response.total });
    } catch (error) {
      setExecutionError(errorMessage(error));
    }
  };

  return (
    <>
      <SettingsBlock
        title="Entity query"
        description="Enter the entity query text DSL used by advanced entity views and saved views."
        footer={
          <div className={styles.actions}>
            <Button variant="primary" disabled={!canRun} onClick={() => void run()}>
              {isPending ? 'Running…' : 'Run query'}
            </Button>
          </div>
        }
      >
        <SettingsBlockField
          label="Query text"
          hint="Evaluated against the entities you can access."
          align="top"
        >
          <TextArea
            aria-label="Query text"
            className={styles.input}
            value={queryText}
            rows={8}
            allowMaximize
            placeholder={'schema:Component AND lifecycle = "active"'}
            onChange={handleQueryChange}
          />
        </SettingsBlockField>
        {(parseErrors.length > 0 || executionError) && (
          <div className={styles.errors}>
            {parseErrors.length > 0 && (
              <div className={styles.error} role="alert">
                {parseErrors.map((error, index) => (
                  <div key={`${error.offset}-${index}`}>
                    Query error at offset {error.offset}: {error.message}
                  </div>
                ))}
              </div>
            )}
            {executionError && (
              <div className={styles.error} role="alert">
                {executionError}
              </div>
            )}
          </div>
        )}
      </SettingsBlock>

      {result && (
        <SettingsBlock title="Raw result" description={`${result.total} record(s) returned`}>
          <pre className={styles.output}>{result.raw}</pre>
        </SettingsBlock>
      )}
    </>
  );
};
