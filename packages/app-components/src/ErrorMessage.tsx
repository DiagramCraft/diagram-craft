import React, { CSSProperties } from 'react';

export const ErrorMessage = (props: {
  children: React.ReactNode;
  style?: CSSProperties;
  className?: string;
}) => {
  return (
    <div
      className={props.className}
      style={{
        color: 'var(--error-fg)',
        marginTop: '0.25rem',
        ...(props.style ?? {})
      }}
    >
      {props.children}
    </div>
  );
};
