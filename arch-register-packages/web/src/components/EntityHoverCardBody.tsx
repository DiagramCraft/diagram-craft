import type { CSSProperties, ReactNode } from 'react';
import {
  HoverCardDescription,
  HoverCardDot,
  HoverCardRows,
  HoverCardTags,
  HoverCardTitle,
  TooltipRow
} from './HoverCardParts';

export type EntityHoverCardRow = { label: ReactNode; value: ReactNode };

/**
 * Presentational entity hover-card content. No fetching - pass already-resolved
 * fields. `titleStyle`/`extra` let a context override formatting without forking
 * the whole body.
 */
export const EntityHoverCardBody = ({
  name,
  description,
  schemaName,
  schemaColor,
  tags,
  rows,
  titleStyle,
  extra
}: {
  name: string;
  description?: string | null;
  schemaName?: string | null;
  schemaColor?: string | null;
  tags?: string[];
  rows?: EntityHoverCardRow[];
  titleStyle?: CSSProperties;
  extra?: ReactNode;
}) => (
  <>
    <HoverCardTitle style={titleStyle}>{name}</HoverCardTitle>

    {description ? <HoverCardDescription>{description}</HoverCardDescription> : null}

    {schemaName || (rows && rows.length > 0) ? (
      <HoverCardRows>
        {schemaName ? (
          <TooltipRow
            label="Type"
            value={
              <>
                {schemaColor ? <HoverCardDot color={schemaColor} /> : null}
                {schemaName}
              </>
            }
          />
        ) : null}
        {rows?.map((row, i) => (
          <TooltipRow key={i} label={row.label} value={row.value} />
        ))}
      </HoverCardRows>
    ) : null}

    {tags && tags.length > 0 ? <HoverCardTags tags={tags} /> : null}

    {extra}
  </>
);
