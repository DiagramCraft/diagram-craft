export function* xIterElements(collection: HTMLCollectionOf<Element>) {
  for (let i = 0; i < collection.length; i++) {
    const $cell = collection.item(i)!;
    if ($cell.nodeType !== Node.ELEMENT_NODE) continue;
    yield $cell;
  }
}

export const xNum = (el: Element, name: string, def = 0) => {
  return Number(el.getAttribute(name) ?? def);
};
