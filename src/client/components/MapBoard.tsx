import type { PublicEdge, PublicPuzzle } from '../../shared/present';
import { chain, rail } from '../lib/draw';

type MapBoardProps = {
  puzzle: PublicPuzzle;
  path: string[];
  legal: string[];
  illegalId: string | null;
  ghost: string[] | null;
  onTap: (id: string) => void;
};

const LETTER: Record<string, string> = {
  depot: 'D',
  market: 'M',
  harbor: 'H',
  hill: 'Λ',
  works: 'W',
  stop: '',
};

export function MapBoard({ puzzle, path, legal, illegalId, ghost, onTap }: MapBoardProps) {
  const at = new Map(puzzle.nodes.map((node) => [node.id, node]));
  const route = path.flatMap((id) => {
    const node = at.get(id);
    return node ? [node] : [];
  });
  const ghostRoute = (ghost ?? []).flatMap((id) => {
    const node = at.get(id);
    return node ? [node] : [];
  });
  const current = path[path.length - 1];
  const previous = path.length > 1 ? path[path.length - 2] : null;
  const here = current ? at.get(current) : undefined;
  const prev = previous ? at.get(previous) : undefined;
  const heading = here && prev ? rail(prev, here).angle : 0;

  return (
    <div className="board">
      <svg viewBox="0 0 1000 1000" role="img" aria-label="Night tram map">
        <rect x="28" y="28" width="944" height="944" fill="none" stroke="#1b2438" strokeOpacity="0.18" strokeWidth="2" rx="8" />
        <text x="48" y="68" className="plate">Night map</text>
        <polyline className="river" points={chain(puzzle.river)} fill="none" strokeWidth="86" strokeLinejoin="round" strokeLinecap="round" />
        <polyline className="river-glint" points={chain(puzzle.river)} fill="none" strokeWidth="16" strokeLinejoin="round" strokeLinecap="round" />
        {puzzle.edges.map((edge) => (
          <Track key={edge.id} edge={edge} a={at.get(edge.a)} b={at.get(edge.b)} />
        ))}
        {ghostRoute.length > 1 ? <polyline className="ghost-route" points={chain(ghostRoute)} /> : null}
        {route.length > 1 ? <polyline className="route" points={chain(route)} /> : null}
        {here ? (
          <g className="tram" transform={`translate(${here.x} ${here.y}) rotate(${heading})`}>
            <rect className="tram-body" x="-18" y="-11" width="36" height="22" rx="6" />
            <rect className="tram-window" x="-8" y="-6" width="12" height="8" rx="2" />
          </g>
        ) : null}
      </svg>
      <div className="stops">
        {puzzle.nodes.map((node) => {
          const visited = path.includes(node.id);
          const classes = [
            'stop',
            node.district === 'depot' ? 'is-depot' : '',
            visited ? 'is-visited' : '',
            node.id === current ? 'is-current' : '',
            legal.includes(node.id) ? 'is-legal' : '',
            illegalId === node.id ? 'is-illegal' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const state = node.id === current ? 'current stop' : visited ? 'visited' : legal.includes(node.id) ? 'open' : 'not connected';
          return (
            <button
              key={node.id}
              type="button"
              className={classes}
              style={{ left: `${node.x / 10}%`, top: `${node.y / 10}%` }}
              aria-label={`${node.name}, ${state}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onTap(node.id)}
            >
              <span className="dot">{LETTER[node.district] ?? ''}</span>
              <span className="name">{node.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Track({ edge, a, b }: { edge: PublicEdge; a: { x: number; y: number } | undefined; b: { x: number; y: number } | undefined }) {
  if (!a || !b) return null;
  const line = rail(a, b);
  const closed = edge.closed;
  return (
    <g>
      <line className={closed ? 'rail closed' : 'rail'} x1={line.ax} y1={line.ay} x2={line.bx} y2={line.by} strokeWidth="3.5" />
      <line className={closed ? 'rail closed' : 'rail'} x1={line.cx} y1={line.cy} x2={line.dx} y2={line.dy} strokeWidth="3.5" />
      {closed ? (
        <g className="barrier" transform={`translate(${line.mx} ${line.my})`}>
          <rect x="-18" y="-14" width="36" height="28" rx="4" />
          <path d="M-8 -7 V7 M8 -7 V7 M-10 0 H10" />
        </g>
      ) : null}
      {edge.oneWay ? (
        <polygon
          className="chevron"
          points="-12,-8 14,0 -12,8"
          transform={`translate(${line.mx} ${line.my}) rotate(${edge.oneWay === 'ab' ? line.angle : line.angle + 180})`}
        />
      ) : null}
    </g>
  );
}
