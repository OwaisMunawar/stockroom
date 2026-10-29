export class SerialQueue {
  private tail: Promise<void> = Promise.resolve();
  run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
