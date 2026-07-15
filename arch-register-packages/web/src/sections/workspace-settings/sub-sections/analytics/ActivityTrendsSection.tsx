import { useState } from 'react';
import type { WorkspaceAnalytics } from '@arch-register/api-types/analyticsContract';
import styles from './WorkspaceAnalyticsScreen.module.css';
import { Section } from './analyticsPrimitives';

export const ActivityTrendsSection = ({
  analytics,
  onNavigate
}: {
  analytics: WorkspaceAnalytics;
  onNavigate: (operation: 'create' | 'update', startDate: string, endDate: string) => void;
}) => {
  const [windowDays, setWindowDays] = useState<30 | 90>(30);
  const buckets =
    windowDays === 30 ? analytics.activityTrends.days30 : analytics.activityTrends.days90;
  const maximum = Math.max(1, ...buckets.map(bucket => bucket.created + bucket.updated));

  return (
    <Section title="Activity trends" sub="Entity create and update activity from audit history.">
      <div className={styles.trendControls}>
        <div className={styles.trendLegend}>
          <span>
            <i className={styles.createdSwatch} />
            Created
          </span>
          <span>
            <i className={styles.updatedSwatch} />
            Updated
          </span>
        </div>
        <fieldset className={styles.windowToggle}>
          <legend className={styles.visuallyHidden}>Activity trend window</legend>
          {[30, 90].map(days => (
            <button
              key={days}
              type="button"
              className={windowDays === days ? styles.windowToggleActive : undefined}
              aria-pressed={windowDays === days}
              onClick={() => setWindowDays(days as 30 | 90)}
            >
              {days} days
            </button>
          ))}
        </fieldset>
      </div>
      <fieldset className={styles.activityChartGroup}>
        <legend className={styles.visuallyHidden}>{windowDays}-day entity activity trend</legend>
        <div
          className={styles.activityChart}
          style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(2px, 1fr))` }}
        >
          {buckets.map(bucket => {
            const total = bucket.created + bucket.updated;
            return (
              <div
                key={bucket.date}
                className={styles.activityDay}
                title={`${bucket.date}: ${bucket.created} created, ${bucket.updated} updated`}
              >
                <div className={styles.activityBars}>
                  {bucket.created > 0 && (
                    <button
                      type="button"
                      className={`${styles.activitySegment} ${styles.createdSegment}`}
                      style={{ height: `${(bucket.created / maximum) * 100}%` }}
                      aria-label={`${bucket.date}: ${bucket.created} entities created; view audit log`}
                      onClick={() => onNavigate('create', bucket.startDate, bucket.endDate)}
                    />
                  )}
                  {bucket.updated > 0 && (
                    <button
                      type="button"
                      className={`${styles.activitySegment} ${styles.updatedSegment}`}
                      style={{ height: `${(bucket.updated / maximum) * 100}%` }}
                      aria-label={`${bucket.date}: ${bucket.updated} entities updated; view audit log`}
                      onClick={() => onNavigate('update', bucket.startDate, bucket.endDate)}
                    />
                  )}
                  {total === 0 && <span className={styles.activityEmpty} />}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className={styles.trendRange}>
        {buckets[0]?.date} – {buckets.at(-1)?.date}
      </div>
    </Section>
  );
};
