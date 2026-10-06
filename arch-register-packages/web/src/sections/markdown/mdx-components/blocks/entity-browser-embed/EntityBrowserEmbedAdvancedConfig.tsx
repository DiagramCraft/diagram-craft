import { useState } from 'react';
import { ADVANCED_CONFIG_KEYS, type EntityBrowserEmbedConfig } from './EntityBrowserEmbedCodec';
import { isMapOverlayConfig } from '../../../../entities/components/mapOverlays';
import styles from './EntityBrowserEmbedConfigForm.module.css';

/** The widget-level config that has no dedicated control, as editable JSON. */
export const advancedConfigOf = (config: EntityBrowserEmbedConfig): Record<string, unknown> =>
  Object.fromEntries(
    ADVANCED_CONFIG_KEYS.filter(key => config[key] !== undefined).map(key => [key, config[key]])
  );

/**
 * Parses edited Advanced JSON into the keys it may set. `null` when the text isn't a JSON object
 * of known advanced keys with valid values.
 */
export const parseAdvancedConfig = (
  text: string
): Pick<EntityBrowserEmbedConfig, 'overlays' | 'dimOwnerIds'> | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim() === '' ? '{}' : text);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).some(key => !(ADVANCED_CONFIG_KEYS as readonly string[]).includes(key))) {
    return null;
  }
  const { overlays, dimOwnerIds } = record;
  if (overlays !== undefined && !(Array.isArray(overlays) && overlays.every(isMapOverlayConfig))) {
    return null;
  }
  if (
    dimOwnerIds !== undefined &&
    !(Array.isArray(dimOwnerIds) && dimOwnerIds.every(id => typeof id === 'string'))
  ) {
    return null;
  }
  return {
    overlays: overlays as EntityBrowserEmbedConfig['overlays'],
    dimOwnerIds: dimOwnerIds as string[] | undefined
  };
};

type Props = {
  config: EntityBrowserEmbedConfig;
  onChange: (config: EntityBrowserEmbedConfig) => void;
};

export const EntityBrowserEmbedAdvancedConfig = ({ config, onChange }: Props) => {
  const [text, setText] = useState(() => JSON.stringify(advancedConfigOf(config), null, 2));
  const isValid = parseAdvancedConfig(text) !== null;

  return (
    <details className={styles.advanced}>
      <summary>Advanced</summary>
      <textarea
        className={styles.advancedJson}
        aria-label="Advanced widget configuration (JSON)"
        aria-invalid={!isValid}
        spellCheck={false}
        rows={6}
        value={text}
        onChange={e => {
          setText(e.target.value);
          const advanced = parseAdvancedConfig(e.target.value);
          if (advanced) onChange({ ...config, ...advanced });
        }}
      />
      {!isValid && (
        <span className={styles.advancedError}>
          Expected a JSON object with the keys {ADVANCED_CONFIG_KEYS.join(', ')}.
        </span>
      )}
    </details>
  );
};
