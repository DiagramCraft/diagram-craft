export const Browser = {
  isChrome: () => {
    return (
      // @ts-expect-error There's no type for userAgentData
      !!navigator.userAgentData &&
      // @ts-expect-error There's no type for userAgentData
      navigator.userAgentData.brands.some(data => data.brand == 'Chromium')
    );
  },
  isSafari: () => {
    return navigator.userAgent.includes('Safari');
  },
  isFirefox: () => {
    return navigator.userAgent.includes('Firefox');
  }
};
