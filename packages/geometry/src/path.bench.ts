import { bench } from 'vitest';

const opts = { time: 2000 };

bench(
  'intersection',
  () => {
    let a = 0;
    for (let i = 0; i < 100; i++) {
      a++;
    }
  },
  opts
);
