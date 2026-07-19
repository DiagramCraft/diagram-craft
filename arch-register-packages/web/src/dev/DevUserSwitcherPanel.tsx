import { useQuery } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import styles from './DevUserSwitcherPanel.module.css';

export const DevUserSwitcherPanel = () => {
  const { data: users, isLoading } = useQuery({
    queryKey: ['dev', 'users'],
    queryFn: () => orpcClient.dev.listUsers()
  });

  const switchTo = async (userId: string) => {
    await orpcClient.dev.switchUser({ body: { userId } });
    window.location.reload();
  };

  if (isLoading) {
    return <div className={styles.hint}>Loading users…</div>;
  }

  if (!users || users.length === 0) {
    return <div className={styles.hint}>No users found</div>;
  }

  return (
    <ul className={styles.list}>
      {users.map(user => (
        <li key={user.id}>
          <button type="button" className={styles.userButton} onClick={() => switchTo(user.id)}>
            <span
              className={styles.colorDot}
              style={{ background: user.color ?? 'var(--gray-6)' }}
            />
            <span className={styles.userLabel}>
              <span className={styles.userName}>{user.user_id}</span>
              <span className={styles.userMeta}>
                {user.display_name ?? user.email ?? user.auth_provider}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};
