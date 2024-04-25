export const xNum = (el: Element, name: string, def = 0) => {
  return Number(el.getAttribute(name) ?? def);
};

export const parseNum = (str: string | null, def = 0) => {
  const n = Number(str);
  return isNaN(n) ? def : n;
};
