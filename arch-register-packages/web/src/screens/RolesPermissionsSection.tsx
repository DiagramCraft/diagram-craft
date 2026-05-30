import { useState, useMemo, Fragment } from 'react';
import {
  WORKSPACE_ROLES,
  WORKSPACE_CAPABILITY_GROUPS,
  WORKSPACE_ROLE_CAPABILITIES,
  type WorkspaceRole,
} from '@arch-register/permissions';
import { TbCheck, TbPlus } from 'react-icons/tb';
import { useWorkspaceMembers } from '../hooks/useWorkspaceMembers';
import styles from './RolesPermissionsSection.module.css';

export const RolesPermissionsSection = ({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) => {
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole | null>(null);
  const { data: members = [] } = useWorkspaceMembers(workspaceSlug);

  const memberCountByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of members) {
      counts[m.role] = (counts[m.role] ?? 0) + 1;
    }
    return counts;
  }, [members]);

  const capCountByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const role of WORKSPACE_ROLES) {
      counts[role.id] = WORKSPACE_ROLE_CAPABILITIES[role.id].length;
    }
    return counts;
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.roleGrid}>
        {WORKSPACE_ROLES.map(role => {
          const isSelected = selectedRole === role.id;
          return (
            <div
              key={role.id}
              className={`${styles.roleCard} ${isSelected ? styles.roleCardSelected : ''}`}
              onClick={() => setSelectedRole(isSelected ? null : role.id)}
            >
              <div className={styles.roleCardHeader}>
                <span className={styles.rolePill}>
                  <span className={styles.roleDot} style={{ background: role.tone }} />
                  {role.name}
                </span>
                {role.builtin && <span className={styles.builtinChip}>Built-in</span>}
              </div>
              <div className={styles.roleDescription}>{role.description}</div>
              <div className={styles.roleStats}>
                <span>
                  <span className={styles.roleStatValue}>{memberCountByRole[role.id] ?? 0}</span> members
                </span>
                <span>
                  <span className={styles.roleStatValue}>{capCountByRole[role.id] ?? 0}</span> capabilities
                </span>
              </div>
            </div>
          );
        })}
        <div className={styles.addRoleCard}>
          <TbPlus size={16} />
          Custom roles coming soon
        </div>
      </div>

      <div className={styles.matrixWrap}>
        <table className={styles.matrix}>
          <thead>
            <tr className={styles.matrixHeaderRow}>
              <th>Capability</th>
              {WORKSPACE_ROLES.map(role => (
                <th
                  key={role.id}
                  className={selectedRole === role.id ? styles.matrixColHighlight : undefined}
                >
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WORKSPACE_CAPABILITY_GROUPS.map(group => (
              <Fragment key={group.label}>
                <tr className={styles.matrixGroupRow}>
                  <td colSpan={WORKSPACE_ROLES.length + 1}>{group.label}</td>
                </tr>
                {group.caps.map(cap => (
                  <tr key={cap.id} className={styles.matrixCapRow}>
                    <td className={styles.matrixCapName}>{cap.name}</td>
                    {WORKSPACE_ROLES.map(role => {
                      const has = WORKSPACE_ROLE_CAPABILITIES[role.id].includes(cap.id);
                      const highlight = selectedRole === role.id;
                      return (
                        <td
                          key={role.id}
                          className={highlight ? styles.matrixColHighlight : undefined}
                        >
                          {has ? (
                            <span className={styles.matrixCheck}><TbCheck /></span>
                          ) : (
                            <span className={styles.matrixDash}>&mdash;</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
