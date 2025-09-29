// See https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
export const hash64 = (arr: Uint8Array, seed = 0): string => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  let ch: number = 0;

  for (let i = 0; i < arr.byteLength; i++) {
    ch = arr[i]!;
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};

// See https://gist.github.com/eplawless/52813b1d8ad9af510d85
export const hash = (arr: Uint8Array): number => {
  let res = 5381;
  for (let i = 0; i < arr.length; i++) {
    res = (res * 33) ^ arr[i]!;
  }
  return res >>> 0;
};
