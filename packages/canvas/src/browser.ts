export const Browser = {
  isChrome: () => {
    return (
      // @ts-ignore
      !!navigator.userAgentData &&
      // @ts-ignore
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
