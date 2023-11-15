export const round = (n: number) => {
  const res = Math.round(n * 100) / 100;
  // To ensure -0 === 0
  if (res === 0) return 0;
  return res;
};
