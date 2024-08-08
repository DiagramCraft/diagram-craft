const metrics = new Map<string, number>();

export const Metrics = {
  counter(name: string, n = 1) {
    const v = metrics.get(name) ?? 0;
    metrics.set(name, v + n);
  },
  gauge(name: string, n: number) {
    metrics.set(name, n);
  }
};

setInterval(() => {
  console.log(metrics);
}, 10000);
