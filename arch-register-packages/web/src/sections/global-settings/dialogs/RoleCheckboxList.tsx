import { GLOBAL_ROLES, type GlobalRole } from '@arch-register/permissions';
import styles from './GlobalPermissionDialogs.module.css';

export const RoleCheckboxList = ({
  roles,
  onToggle,
  disabled
}: {
  roles: GlobalRole[];
  onToggle: (role: GlobalRole) => void;
  disabled: boolean;
}) => (
  <div className={styles.list}>
    {GLOBAL_ROLES.map(role => (
      <label key={role.id} className={styles.roleRow}>
        <div>
          <div className={styles.roleTitle}>
            <span className={styles.roleDot} style={{ background: role.tone }} />
            {role.name}
          </div>
          <div className={styles.roleDescription}>{role.description}</div>
        </div>
        <input
          type="checkbox"
          checked={roles.includes(role.id)}
          onChange={() => onToggle(role.id)}
          disabled={disabled}
        />
      </label>
    ))}
  </div>
);
