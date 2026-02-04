export class WorkQueue {
  queue: [Array<() => void>, Array<() => void>] = [[], []];

  add(work: () => void, priority: 0 | 1 = 0) {
    this.queue[priority].push(work);
  }

  run() {
    this.queue[0].forEach(work => work());
    this.queue[1].forEach(work => work());
  }
}
