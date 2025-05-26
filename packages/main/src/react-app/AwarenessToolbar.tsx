import styles from './AwarenessToolbar.module.css';
import { CollaborationConfig } from '@diagram-craft/model/collaboration/collaborationConfig';
import { useEventListener } from './hooks/useEventListener';
import { useRedraw } from './hooks/useRedraw';
import { debounce } from '@diagram-craft/utils/debounce';
import React from 'react';

export const AwarenessToolbar = () => {
  const redraw = useRedraw();
  const redrawDebounced = debounce(redraw, 500);
  useEventListener(CollaborationConfig.Backend.awareness!, 'changeUser', () => {
    redrawDebounced();
  });

  const seenUsers: Set<string> = new Set();

  return (
    <div id="awareness" className={styles.cmpAwarenessToolbar}>
      {CollaborationConfig.Backend.awareness!.getUserStates()
        .filter(user => !!user && !!user.name && !seenUsers.has(user.name))
        .map(user => {
          seenUsers.add(user.name);
          return user;
        })
        .map(user => (
          <div
            key={user.name}
            className={styles.cmpAwarenessToolbarUser}
            style={{ '--avatar-color': user.color } as React.CSSProperties}
          >
            {user.name[0]}
            {user.name[1].toUpperCase()}
          </div>
        ))}
    </div>
  );
};
