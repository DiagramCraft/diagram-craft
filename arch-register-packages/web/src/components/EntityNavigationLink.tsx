import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { useEntityDrawer } from '../sections/entities/entityDrawer/useEntityDrawer';
import { asEntityPublicId, entityDetailRoute } from '../routes/publicObjectRoutes';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  publicId: string;
};

/**
 * The shared way to link to an entity from an inline reference (table cell, chip, card, relation
 * endpoint, markdown mention, etc). Renders a real anchor via TanStack's `Link` — so deep-linking,
 * keyboard activation, and modifier-click/right-click "open in new tab" all work natively — but a
 * plain left-click opens the entity's drawer instead of navigating to the full overview page
 * (#3313). Pass `onClick` for additional caller behavior (e.g. closing a popover); call
 * `event.preventDefault()` in it to opt out of the drawer-open default for that click.
 */
export const EntityNavigationLink = forwardRef<HTMLAnchorElement, Props>(
  ({ publicId, onClick, ...props }, ref) => {
    const { workspaceSlug } = useWorkspaceContext();
    const { openEntityDrawer } = useEntityDrawer();

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      event.stopPropagation();

      const opensElsewhere =
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0 ||
        (!!props.target && props.target !== '_self');
      if (opensElsewhere) return;

      event.preventDefault();
      openEntityDrawer(publicId);
    };

    return (
      <Link
        {...entityDetailRoute(workspaceSlug, asEntityPublicId(publicId))}
        {...props}
        onClick={handleClick}
        ref={ref}
      />
    );
  }
);

EntityNavigationLink.displayName = 'EntityNavigationLink';
