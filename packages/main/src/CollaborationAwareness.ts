import { EventEmitter } from '@diagram-craft/utils/event';
import type { AwarenessUserState } from '@diagram-craft/collaboration/awareness';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import { AppConfig } from './appConfig';

type CollaborationAwarenessEvents = {
  change: { after: CollaborationAwareness };
};

export type AwarenessConfig = Pick<AppConfig['awareness'], 'name' | 'color'>;

/**
 * Per-editor collaboration identity. This state is runtime-only and is never
 * serialized with user preferences or document recovery data.
 */
export class CollaborationAwareness extends EventEmitter<CollaborationAwarenessEvents> {
  #state: AwarenessUserState | undefined;

  constructor(private readonly config: AwarenessConfig = AppConfig.get().awareness) {
    super();
  }

  get state(): AwarenessUserState {
    return (this.#state ??= {
      name: this.config.name(),
      color: this.config.color()
    });
  }

  set state(value: AwarenessUserState) {
    if (this.#state?.name === value.name && this.#state?.color === value.color) return;

    this.#state = value;
    CollaborationConfig.Backend.awareness?.updateUser(value);
    this.emit('change', { after: this });
  }
}
