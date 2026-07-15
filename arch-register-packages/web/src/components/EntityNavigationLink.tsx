import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { Link } from '@tanstack/react-router';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { asEntityPublicId, entityDetailRoute } from '../routes/publicObjectRoutes';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  publicId: string;
};

export const EntityNavigationLink = forwardRef<HTMLAnchorElement, Props>(
  ({ publicId, ...props }, ref) => {
    const { workspaceSlug } = useWorkspaceContext();
    return (
      <Link
        {...entityDetailRoute(workspaceSlug, asEntityPublicId(publicId))}
        {...props}
        ref={ref}
      />
    );
  }
);

EntityNavigationLink.displayName = 'EntityNavigationLink';
