export const Browser = {
  isChrome: () => {
    return (
      // @ts-expect-error There's no type for userAgentData
      !!navigator.userAgentData &&
      // @ts-expect-error There's no type for userAgentData
      (navigator.userAgentData.brands.some(data => data.brand === 'Chromium') as boolean)
    );
  },
  isSafari: () => {
    return navigator.userAgent.includes('Safari');
  },
  isFirefox: () => {
    return navigator.userAgent.includes('Firefox');
  }
};
