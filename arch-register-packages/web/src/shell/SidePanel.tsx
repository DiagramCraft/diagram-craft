import { useMatches } from '@tanstack/react-router';
import styles from './SidePanel.module.css';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { deriveActiveView } from '../layouts/deriveActiveView';
import { HomeSidebar } from '../sections/home/HomeSidebar';
import { ProjectsSidebar } from '../sections/projects/ProjectsSidebar';
import { EntitiesSidebar } from '../sections/entities/EntitiesSidebar';
import { DataModelSidebar } from '../sections/data-model/DataModelSidebar';
import { SearchSidebar } from '../sections/search/SearchSidebar';
import { WorkspaceSettingsSidebar } from '../sections/workspace-settings/WorkspaceSettingsSidebar';
import { GlobalSettingsSidebar } from '../sections/global-settings/GlobalSettingsSidebar';
import { AccountSettingsSidebar } from '../sections/account-settings/AccountSettingsSidebar';

export const SidePanel = () => {
  const matches = useMatches();
  const view = deriveActiveView(matches);
  const ctx = useWorkspaceContext();

  let body: React.ReactNode;

  if (view === 'home') {
    body = (
      <HomeSidebar
        schemas={ctx.schemas}
        projects={ctx.projects}
        workspaceSlug={ctx.workspaceSlug}
      />
    );
  } else if (view === 'project-detail') {
    body = <ProjectsSidebar projects={ctx.projects} workspaceSlug={ctx.workspaceSlug} />;
  } else if (view === 'entity-browser' || view === 'entity-detail') {
    body = (
      <EntitiesSidebar
        schemas={ctx.schemas}
        lifecycleStates={ctx.lifecycleStates}
        workspaceSlug={ctx.workspaceSlug}
      />
    );
  } else if (view === 'data-model') {
    body = (
      <DataModelSidebar schemas={ctx.schemas} enums={ctx.enums} workspaceSlug={ctx.workspaceSlug} />
    );
  } else if (view === 'search') {
    body = <SearchSidebar />;
  } else if (view === 'workspace-settings') {
    body = (
      <WorkspaceSettingsSidebar
        workspaceSlug={ctx.workspaceSlug}
        workspace={ctx.workspace}
        schemas={ctx.schemas}
        projects={ctx.projects}
        availableSections={ctx.availableSettingsSections}
      />
    );
  } else if (view === 'global-settings') {
    body = <GlobalSettingsSidebar />;
  } else if (view === 'account-settings') {
    body = <AccountSettingsSidebar />;
  }

  return <div className={styles.panel}>{body}</div>;
};