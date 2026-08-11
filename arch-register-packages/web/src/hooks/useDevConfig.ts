import { useQuery } from '@tanstack/react-query';
import { devConfigQuery, devKeys } from '../queries/dev';

export const devConfigKeys = devKeys.config;

export const useDevConfig = () => {
  return useQuery(devConfigQuery());
};
