import type React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbExternalLink } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import { EntityNavigationLink } from '../../components/EntityNavigationLink';
import { useEntityDrawer } from '../entities/entityDrawer/useEntityDrawer';
import {
  asProjectPublicId,
  projectDetailRoute,
  workspaceMarkdownRoute
} from '../../routes/publicObjectRoutes';
import type { CaseSubject } from './useCaseSubjects';
import styles from './GovernanceInboxScreen.module.css';

export const previewNote = (note: string) => (note.length > 180 ? `${note.slice(0, 177)}…` : note);

/** Row click handler that opens the case drawer, unless the click was on one of the row's own controls */
export const useCaseRowClick = () => {
  const { openCaseDrawer } = useEntityDrawer();
  return (caseId: string) => (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    openCaseDrawer(caseId);
  };
};

export const InitiationFieldSummary = ({
  fields
}: {
  fields: Array<{ id: string; label: string; value: unknown }>;
}) => {
  const populated = fields.filter(field => field.value != null && field.value !== '');
  if (populated.length === 0) return null;
  return (
    <div className={styles.taskNote}>
      {populated.map(field => (
        <div key={field.id}>
          <span className={styles.taskNoteLabel}>{field.label}</span>{' '}
          {Array.isArray(field.value) ? field.value.join(', ') : String(field.value)}
        </div>
      ))}
    </div>
  );
};

/** The member entities of a bulk change, as a comma separated list of entity links */
export const BulkMemberLinks = ({ subject }: { subject: CaseSubject }) => {
  if (!subject.isBulk || subject.bulkMembers.length === 0) return null;
  return (
    <div className={styles.taskMeta}>
      {subject.bulkMembers.map((memberEntity, index) => (
        <span key={memberEntity._uid}>
          {index > 0 && <span>, </span>}
          {memberEntity._publicId ? (
            <EntityNavigationLink publicId={memberEntity._publicId}>
              {memberEntity._name}
            </EntityNavigationLink>
          ) : (
            memberEntity._name
          )}
        </span>
      ))}
    </div>
  );
};

/** Navigates to a document or assessment subject; entities are reached through the case drawer */
export const ViewSubjectButton = ({
  workspace,
  kase
}: {
  workspace: string;
  kase: GovernanceCase;
}) => {
  const navigate = useNavigate();
  if (kase.subjectType !== 'document' && kase.subjectType !== 'assessment') return null;

  const viewSubject = () => {
    if (kase.subjectType === 'document') {
      navigate(workspaceMarkdownRoute(workspace, kase.subjectId, { mode: 'preview' }));
      return;
    }
    const projectId = kase.payload['projectId'] as string | undefined;
    if (projectId) {
      navigate(
        projectDetailRoute(workspace, asProjectPublicId(projectId), {
          section: 'assessments',
          assessmentId: kase.subjectId
        })
      );
    }
  };

  return (
    <Button variant="ghost" icon={<TbExternalLink size={12} />} onClick={viewSubject}>
      {kase.subjectType === 'document' ? 'View document' : 'View assessment'}
    </Button>
  );
};
