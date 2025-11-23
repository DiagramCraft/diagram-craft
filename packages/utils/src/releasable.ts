/**
 * Interface for objects that need explicit resource cleanup.
 *
 * Use this for objects that hold resources like:
 * - Event subscriptions
 * - Timers (setTimeout, setInterval)
 * - External connections
 * - Large data structures
 *
 * @example
 * ```typescript
 * class MyClass extends ReleasableBase {
 *   constructor() {
 *     super();
 *
 *     const timer = setInterval(() => {}, 1000);
 *     this.addReleasable(new TimerReleasable(timer, true));
 *
 *     const unsubscribe = emitter.on('event', () => {});
 *     this.addReleasable(new EventSubscription(unsubscribe));
 *   }
 * }
 *
 * const instance = new MyClass();
 * instance.release(); // Cleans up all resources
 * ```
 */
export interface Releasable {
  /**
   * Release all held resources. After calling this method, the object
   * should not be used anymore.
   *
   * Implementations should make this method idempotent - calling it
   * multiple times should have no additional effect.
   */
  release(): void;
}

/**
 * Wrapper for setTimeout/setInterval that can be released.
 */
export class TimerReleasable implements Releasable {
  #timerId: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | undefined;
  #isReleased = false;
  readonly #isInterval: boolean;

  constructor(
    timerId: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>,
    isInterval = false
  ) {
    this.#timerId = timerId;
    this.#isInterval = isInterval;
  }

  release(): void {
    if (this.#isReleased || this.#timerId === undefined) return;
    this.#isReleased = true;

    if (this.#isInterval) {
      clearInterval(this.#timerId);
    } else {
      clearTimeout(this.#timerId);
    }
    this.#timerId = undefined;
  }
}

/**
 * Composite that holds multiple releasables and releases them all together.
 */
export class Releasables implements Releasable {
  readonly #releasables: Array<Releasable | (() => void)> = [];
  #isReleased = false;

  /**
   * Add a releasable resource to the collection.
   *
   * @param releasable - Either a Releasable object or a cleanup function
   */
  add(releasable: Releasable | (() => void)): void {
    if (this.#isReleased) {
      this.releaseEntry(releasable);
    } else {
      this.#releasables.push(releasable);
    }
  }

  release(): void {
    if (this.#isReleased) return;
    this.#isReleased = true;

    for (let i = 0; i < this.#releasables.length; i++) {
      const r = this.#releasables[i];
      if (!r) continue;

      try {
        this.releaseEntry(r);
      } catch (error) {
        console.error(error);
      }
    }
    this.#releasables.splice(0, this.#releasables.length);
  }

  private releaseEntry(entry: Releasable | (() => void)): void {
    if (typeof entry === 'function') {
      entry();
    } else {
      entry.release();
    }
  }
}
