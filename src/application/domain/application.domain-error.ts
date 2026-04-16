export class InvalidApplicationStatusTransitionError extends Error {
  constructor() {
    super('INVALID_STATUS_TRANSITION');
    this.name = 'InvalidApplicationStatusTransitionError';
  }
}
