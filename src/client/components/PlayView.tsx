import { useEffect, useMemo, useRef, useState } from 'react';
import { constraintDetail, constraintLabel } from '../../shared/constraints';
import type { PublicPuzzle } from '../../shared/present';
import { outgoing, legality } from '../../shared/route';
import { formatClock, formatLength } from '../../shared/score';
import type { Playable } from '../../shared/types';
import { beaconAbandon, postEvent } from '../lib/api';
import { Owl } from './Owl';
import { MapBoard } from './MapBoard';

type PlayViewProps = {
  puzzle: PublicPuzzle;
  date: string;
  banner: string | null;
  ghost: string[] | null;
  onLeave: (() => void) | null;
  onSolved: (path: string[], elapsedMs: number) => Promise<void>;
};

function asPlayable(puzzle: PublicPuzzle): Playable {
  return {
    nodes: puzzle.nodes,
    edges: puzzle.edges,
    constraint: puzzle.constraint,
    required: puzzle.required,
    depotId: puzzle.depotId,
  };
}

export function PlayView({ puzzle, date, banner, ghost, onLeave, onSolved }: PlayViewProps) {
  const playable = useMemo(() => asPlayable(puzzle), [puzzle]);
  const [path, setPath] = useState<string[]>([puzzle.depotId]);
  const [illegalId, setIllegalId] = useState<string | null>(null);
  const [hint, setHint] = useState(() => {
    try {
      return localStorage.getItem('owl-line-hint') !== 'off';
    } catch {
      return true;
    }
  });
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState('');
  const solved = useRef(false);

  const last = path[path.length - 1] ?? puzzle.depotId;
  const legal = outgoing(playable, last).map((hop) => hop.to);
  const checked = legality(playable, path);
  const ready = checked.ok && !busy;
  let length = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    if (!from || !to) break;
    const hop = outgoing(playable, from).find((item) => item.to === to);
    if (!hop) break;
    length += hop.edge.w;
  }
  const elapsed = started ? now - started : 0;

  useEffect(() => {
    if (!started || solved.current) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [started]);

  useEffect(() => {
    if (!illegalId) return undefined;
    const id = window.setTimeout(() => setIllegalId(null), 420);
    return () => window.clearTimeout(id);
  }, [illegalId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace') return;
      event.preventDefault();
      setPath((current) => (current.length > 1 ? current.slice(0, -1) : current));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const leave = () => {
      if (!solved.current && started) beaconAbandon(date);
    };
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, [date, started]);

  function undo() {
    setPath((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }

  function tap(id: string) {
    if (hint) {
      setHint(false);
      try {
        localStorage.setItem('owl-line-hint', 'off');
      } catch {
        // The hint can stay quiet if storage is blocked.
      }
    }
    if (id === last && path.length > 1) {
      undo();
      return;
    }
    if (!legal.includes(id)) {
      setIllegalId(id);
      setLive('That track is not open.');
      return;
    }
    if (!started) {
      setStarted(Date.now());
      postEvent('first_move', date);
    }
    setPath((current) => [...current, id]);
    setLive('');
  }

  async function finish() {
    if (!checked.ok || !started) return;
    setBusy(true);
    try {
      await onSolved(path, Date.now() - started);
      solved.current = true;
    } catch (error) {
      setBusy(false);
      setLive(error instanceof Error ? error.message : 'The yard did not answer.');
    }
  }

  const icon = puzzle.constraint.kind === 'bridge_closed' ? '×' : puzzle.constraint.kind === 'one_way' ? '→' : '•';

  return (
    <>
      <header className="top">
        <div className="brand">
          <Owl size={36} />
          <div>
            <strong>Owl Line</strong>
            <span>{puzzle.theme}</span>
          </div>
        </div>
        <div className="meters">
          <b>{formatLength(length)}</b>
          <span>{formatClock(elapsed)}</span>
        </div>
      </header>
      <div className="badge">
        <span className="mark" aria-hidden="true">{icon}</span>
        <div>
          <b>{constraintLabel(puzzle.constraint)}</b>
          <small>{constraintDetail(puzzle.constraint)}</small>
        </div>
      </div>
      {banner ? <p className="banner">{banner}</p> : null}
      {hint ? <p className="hint">Tap the next stop. Follow the tracks.</p> : null}
      <p className="sr" aria-live="polite">{live}</p>
      <div className="stage">
        <MapBoard puzzle={puzzle} path={path} legal={legal} illegalId={illegalId} ghost={ghost} onTap={tap} />
      </div>
      <div className="dock">
        {onLeave ? (
          <button type="button" className="ghost" onClick={onLeave}>Leave</button>
        ) : (
          <button type="button" className="ghost" onClick={() => setPath([puzzle.depotId])}>Clear</button>
        )}
        <button type="button" className="ghost" onClick={undo}>Undo</button>
        <button type="button" className="primary" disabled={!ready} onClick={() => void finish()}>
          Complete service
        </button>
      </div>
    </>
  );
}
