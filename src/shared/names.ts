import type { District } from './types';

export const STOP_NAMES = [
  'Elm',
  'Quay',
  'Lantern',
  'North',
  'South',
  'Mill',
  'Arch',
  'Pond',
  'Gate',
  'Yard',
  'Wharf',
  'Crown',
  'Bell',
  'Moss',
  'Vine',
  'Kiln',
  'Lock',
  'Pier',
] as const;

const MAP_LEFT = ['Harbor', 'Rain', 'Amber', 'Quiet', 'North', 'Fog', 'Tide', 'Hill', 'Lantern', 'Moss', 'Bell'] as const;
const MAP_RIGHT = ['Loop', 'Shuttle', 'Line', 'Service', 'Turn', 'Run', 'Route', 'Span', 'Yard'] as const;

const DISPATCH_LEFT = ['lantern', 'night', 'quiet', 'amber', 'harbor', 'moss', 'bell', 'north'] as const;
const DISPATCH_RIGHT = ['owl', 'car', 'yard', 'tide', 'mill', 'wharf', 'lock', 'pier'] as const;

export const THEMES = [
  'Lantern fog',
  'Rain on the glass',
  'Market night',
  'Harbor tide',
  'Hill wind',
  'Last bell',
  'Quiet yards',
] as const;

export function districtLabel(district: District): string {
  switch (district) {
    case 'depot':
      return 'Depot';
    case 'market':
      return 'Market';
    case 'harbor':
      return 'Harbor';
    case 'hill':
      return 'Hill';
    case 'works':
      return 'Works';
    case 'stop':
      return 'Stop';
  }
}

export function assignStopNames(districts: readonly District[]): string[] {
  const names: string[] = [];
  let pool = 0;
  for (const district of districts) {
    if (district !== 'stop') {
      names.push(districtLabel(district));
      continue;
    }
    const name = STOP_NAMES[pool % STOP_NAMES.length] ?? 'Stop';
    pool += 1;
    names.push(name);
  }
  return names;
}

export function communityMapName(rand: () => number): string {
  const left = MAP_LEFT[Math.floor(rand() * MAP_LEFT.length)] ?? 'Harbor';
  const right = MAP_RIGHT[Math.floor(rand() * MAP_RIGHT.length)] ?? 'Loop';
  const line = 1 + Math.floor(rand() * 9);
  const roll = rand();
  if (roll < 0.4) return `${left} ${right}`;
  if (roll < 0.75) return `${left} on Line ${line}`;
  return `The ${left} ${right}`;
}

export function dispatcherName(index: number): string {
  const left = DISPATCH_LEFT[index % DISPATCH_LEFT.length] ?? 'night';
  const right = DISPATCH_RIGHT[Math.floor(index / DISPATCH_LEFT.length) % DISPATCH_RIGHT.length] ?? 'owl';
  return `${left}-${right}`;
}

export function isDispatcherName(name: string): boolean {
  const parts = name.split('-');
  if (parts.length !== 2) return false;
  const left = parts[0];
  const right = parts[1];
  if (!left || !right) return false;
  return (DISPATCH_LEFT as readonly string[]).includes(left) && (DISPATCH_RIGHT as readonly string[]).includes(right);
}

export function lineTitle(streak: number, stars: number): string {
  if (streak >= 7) return `${streak}-night streak`;
  if (stars >= 3) return 'Perfect service';
  return 'Night Dispatcher';
}
