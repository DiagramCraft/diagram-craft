import { Banner } from '../../components/Banner';

export const MutationError = ({ error }: { error?: Error | null }) =>
  error ? <Banner variant="error">{error.message}</Banner> : null;
