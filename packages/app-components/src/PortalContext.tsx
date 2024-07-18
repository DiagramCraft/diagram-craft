import React, { useState } from 'react';

const PortalContext = React.createContext<HTMLDivElement | null>(null);

export const PortalContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  return (
    <PortalContext.Provider value={ref}>
      <div ref={setRef} style={{ position: 'absolute', left: '-1000px', top: '-1000px' }}></div>
      {children}
    </PortalContext.Provider>
  );
};

export const usePortal = () => {
  const r = React.useContext(PortalContext);
  if (!r) return undefined;
  return r;
};
