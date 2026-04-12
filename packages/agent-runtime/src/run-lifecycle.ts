export const RUN_STATES = [
  'queued',
  'planning',
  'waiting_approval',
  'executing',
  'completed',
  'failed',
  'cancelled'
] as const;

export type RunState = (typeof RUN_STATES)[number];

export const RUN_TRANSITIONS: Readonly<Record<RunState, readonly RunState[]>> = {
  queued: ['planning', 'cancelled'],
  planning: ['waiting_approval', 'executing', 'failed', 'cancelled'],
  waiting_approval: ['planning', 'executing', 'cancelled', 'failed'],
  executing: ['completed', 'failed', 'cancelled', 'waiting_approval'],
  completed: [],
  failed: [],
  cancelled: []
};

export interface RunLifecycle {
  current: RunState;
  canTransitionTo: (next: RunState) => boolean;
  transitionTo: (next: RunState) => RunState;
}

export function isRunState(value: string): value is RunState {
  return RUN_STATES.includes(value as RunState);
}

export function canTransition(from: RunState, to: RunState): boolean {
  return RUN_TRANSITIONS[from].includes(to);
}

export function createRunLifecycle(initial: RunState = 'queued'): RunLifecycle {
  let current = initial;

  return {
    get current(): RunState {
      return current;
    },
    canTransitionTo(next: RunState): boolean {
      return canTransition(current, next);
    },
    transitionTo(next: RunState): RunState {
      if (!canTransition(current, next)) {
        throw new Error(`RUN_STATE_TRANSITION_INVALID:${current}->${next}`);
      }

      current = next;
      return current;
    }
  };
}
