/** @namespace */
export const Browser = {
  isChrome: () => {
    if (typeof navigator === 'undefined') return false;
    return (
      // @ts-expect-error There's no type for userAgentData
      !!navigator.userAgentData &&
      // @ts-expect-error There's no type for userAgentData
      (navigator.userAgentData.brands.some(data => data.brand === 'Chromium') as boolean)
    );
  },
  isSafari: () => {
    if (typeof navigator === 'undefined') return false;
    return navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
  },
  isFirefox: () => {
    if (typeof navigator === 'undefined') return false;
    return navigator.userAgent.includes('Firefox');
  }
};
