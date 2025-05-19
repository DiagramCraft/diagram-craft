export type UserState = {
  name: string;
};

export interface Awareness {
  updateUser(state: UserState): void;
}

export class NoOpAwareness implements Awareness {
  updateUser() {}
}
