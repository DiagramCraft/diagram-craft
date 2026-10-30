import { Stack } from './Stack';

export const Page = (props: { children: React.ReactNode }) => {
  return (
    <div
      style={{
        padding: '20px 24px 12px',
        height: '100%',
        overflowY: 'auto'
      }}
    >
      <Stack>{props.children}</Stack>
    </div>
  );
};
