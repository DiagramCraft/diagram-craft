export type UserState = {
  'panel.left'?: number;
  'panel.right'?: number;
};

export const UserState = {
  getState: (): UserState => {
    return JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}');
  },
  setState: (state: UserState) => {
    localStorage.setItem('diagram-craft.user-state', JSON.stringify(state));
  },
  set: <K extends keyof UserState>(key: K, value: UserState[K]) => {
    const state = UserState.getState();
    state[key] = value;
    UserState.setState(state);
  }
};
