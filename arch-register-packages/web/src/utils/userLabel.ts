export const getUserLabel = (user: { display_name: string; email: string | null; id?: string }) =>
  user.display_name || user.email || user.id || '';
