export function* mapIterator<T, K>(
  iterator: IterableIterator<T>,
  callback: (value: T) => K
): Iterator<K> {
  for (const value of iterator) {
    yield callback(value);
  }
}
