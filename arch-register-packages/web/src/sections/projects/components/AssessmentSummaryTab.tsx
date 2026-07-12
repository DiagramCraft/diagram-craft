import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import styles from './AssessmentSummaryTab.module.css';
import { EmptyState } from '../../../components/EmptyState';

type Props = {
  assessment: Assessment;
  responses: AssessmentResponse[];
  entityCount: number;
  enums: WorkspaceEnum[];
};

const ProgressBar = ({ pct }: { pct: number }) => (
  <div className={styles.progressTrack}>
    <div className={styles.progressFill} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
  </div>
);

export const AssessmentSummaryTab = ({ assessment, responses, entityCount, enums }: Props) => {
  const total = responses.length;
  const pctAssessed = entityCount > 0 ? Math.round((total / entityCount) * 100) : 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Entities assessed</div>
          <div className={styles.statBig}>
            {total} / {entityCount}
          </div>
          <ProgressBar pct={pctAssessed} />
          <div className={styles.statSub}>{pctAssessed}% of in-scope entities have a recorded response</div>
        </div>

        {total === 0 ? (
          <div className={styles.empty}>
            <EmptyState compact title="No responses recorded yet." />
          </div>
        ) : (
          assessment.fields.map(field => {
            if (field.type === 'rating') {
              const values = responses
                .map(r => r.values[field.id])
                .filter((v): v is number => typeof v === 'number');
              const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
              return (
                <div key={field.id} className={styles.card}>
                  <div className={styles.cardTitle}>{field.label}</div>
                  <div className={styles.statBig}>{avg !== null ? avg.toFixed(1) : '—'} / 5</div>
                  {avg !== null && <ProgressBar pct={(avg / 5) * 100} />}
                  <div className={styles.statSub}>
                    {values.length} of {total} answered
                  </div>
                </div>
              );
            }

            if (field.type === 'enum') {
              const enumDef = enums.find(e => e.id === field.enumId);
              const counts = new Map<string, number>();
              for (const r of responses) {
                const value = r.values[field.id];
                if (value === undefined) continue;
                const key = String(value);
                counts.set(key, (counts.get(key) ?? 0) + 1);
              }
              return (
                <div key={field.id} className={styles.card}>
                  <div className={styles.cardTitle}>{field.label}</div>
                  {counts.size === 0 ? (
                    <div className={styles.statSub}>No responses</div>
                  ) : (
                    <div className={styles.distribution}>
                      {[...counts.entries()].map(([value, count]) => {
                        const label = enumDef?.options.find(o => o.value === value)?.label ?? value;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={value} className={styles.distRow}>
                            <span className={styles.distLabel}>{label}</span>
                            <div className={styles.distBarTrack}>
                              <div className={styles.distBarFill} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={styles.distValue}>
                              {count} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const answered = responses.filter(r => r.values[field.id] !== undefined).length;
            const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
            return (
              <div key={field.id} className={styles.card}>
                <div className={styles.cardTitle}>{field.label}</div>
                <div className={styles.statBig}>{pct}%</div>
                <ProgressBar pct={pct} />
                <div className={styles.statSub}>
                  {answered} of {total} filled in
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
