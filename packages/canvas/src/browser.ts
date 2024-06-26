export const Browser = {
  isChrome: () => {
    return (
      // @ts-ignore
      !!navigator.userAgentData &&
      // @ts-ignore
      navigator.userAgentData.brands.some(data => data.brand == 'Chromium')
    );
  }
};
