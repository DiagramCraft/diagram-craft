import { useQuery } from '@tanstack/react-query';
import { authConfigKeys as authConfigKeysFromQueries, authConfigQuery } from '../queries/auth';

export const authConfigKeys = authConfigKeysFromQueries;

export const useAuthConfig = () => {
  return useQuery(authConfigQuery());
};
