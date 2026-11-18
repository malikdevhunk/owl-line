import { formatLength } from './score';
import type { Constraint, ConstraintKind } from './types';

export function constraintLabel(constraint: Constraint): string {
  switch (constraint.kind) {
    case 'bridge_closed':
      return 'Bridge closed';
    case 'one_way':
      return 'One-way on the hill';
    case 'market_first':
      return 'Market first';
    case 'short_budget':
      return 'Tight track budget';
    case 'works_last':
      return 'Works, then home';
  }
}

export function constraintDetail(constraint: Constraint): string {
  switch (constraint.kind) {
    case 'bridge_closed':
      return 'The dashed bridge is out until morning.';
    case 'one_way':
      return 'Follow the arrows. Those tracks run one way.';
    case 'market_first':
      return 'Serve the market before the hill.';
    case 'short_budget':
      return `Stay within ${formatLength(constraint.budget)} of track.`;
    case 'works_last':
      return 'Call at the works, then bring the car home.';
  }
}

export function kindLabel(kind: ConstraintKind): string {
  switch (kind) {
    case 'bridge_closed':
      return 'Bridge closed';
    case 'one_way':
      return 'One-way on the hill';
    case 'market_first':
      return 'Market first';
    case 'short_budget':
      return 'Tight track budget';
    case 'works_last':
      return 'Works, then home';
  }
}
