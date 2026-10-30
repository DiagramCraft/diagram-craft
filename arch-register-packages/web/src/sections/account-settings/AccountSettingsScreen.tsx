import { useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Title } from '../../components/Title';
import { Page } from '../../components/Page';
import { useAuth } from '../../auth/AuthContext';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { SectionActionsSlotContext } from '../workspace-settings/SectionActions';
import { resolveAccountSection } from './accountSections';
import { ProfileSubSection } from './ProfileSubSection';
import { AppearanceSubSection } from './AppearanceSubSection';
import { NotificationPreferencesSubSection } from './NotificationPreferencesSubSection';
import { ApiTokensSubSection } from './ApiTokensSubSection';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/account/$section');

export const AccountSettingsScreen = () => {
  const navigate = routeApi.useNavigate();
  const params = routeApi.useParams();
  const { user } = useAuth();
  const { workspaceSlug } = useWorkspaceContext();
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);

  if (!user) return null;

  const section = resolveAccountSection(params.section);

  return (
    <SectionActionsSlotContext.Provider value={actionsSlot}>
      <Page>
        <Title
          breadcrumb={[
            {
              label: 'Home',
              onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
            },
            { label: 'Account settings' }
          ]}
          title={section.label}
          description={section.description}
          buttons={<div ref={setActionsSlot} style={{ display: 'contents' }} />}
        />

        {section.id === 'profile' && <ProfileSubSection />}
        {section.id === 'appearance' && <AppearanceSubSection />}
        {section.id === 'notifications' && <NotificationPreferencesSubSection />}
        {section.id === 'api-tokens' && <ApiTokensSubSection />}
      </Page>
    </SectionActionsSlotContext.Provider>
  );
};
