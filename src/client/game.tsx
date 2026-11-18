import './styles.css';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { SolveResponse, SplashResponse } from '../shared/api';
import type { PublicPuzzle } from '../shared/present';
import { legality } from '../shared/route';
import { lineTitle } from '../shared/names';
import { formatLength, shareLine, starsFor } from '../shared/score';
import type { DraftBody, Playable } from '../shared/types';
import { EditorView } from './components/EditorView';
import { Lantern } from './components/Owl';
import { PlayView } from './components/PlayView';
import { ResultCard } from './components/ResultCard';
import { WorkshopView } from './components/WorkshopView';
import {
  getBoard,
  getCommunityMap,
  getGhost,
  getPuzzle,
  getSplash,
  postCommunitySolve,
  postEvent,
  postMap,
  postSolve,
} from './lib/api';
import { readPostDate } from './lib/bridge';

type Playtest = { puzzle: PublicPuzzle; Lstar: number };

export function App() {
  const [splash, setSplash] = useState<SplashResponse | null>(null);
  const [puzzle, setPuzzle] = useState<PublicPuzzle | null>(null);
  const [date, setDate] = useState('');
  const [view, setView] = useState<'load' | 'play' | 'result' | 'workshop' | 'editor' | 'error'>('load');
  const [error, setError] = useState('');
  const [result, setResult] = useState<SolveResponse | null>(null);
  const [community, setCommunity] = useState<{ id: string; name: string } | null>(null);
  const [communityPuzzle, setCommunityPuzzle] = useState<PublicPuzzle | null>(null);
  const [playtest, setPlaytest] = useState<Playtest | null>(null);
  const [ghost, setGhost] = useState<string[] | null>(null);
  const [lastPath, setLastPath] = useState<string[]>([]);
  const [lastElapsed, setLastElapsed] = useState(0);
  const [editorOn, setEditorOn] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    void boot();
  }, []);

  async function boot() {
    try {
      const posted = readPostDate();
      const night = await getSplash(posted ?? undefined);
      const pack = await getPuzzle(night.date);
      setSplash(night);
      setPuzzle(pack.puzzle);
      setDate(night.date);
      postEvent('play_start', night.date);
      if (
        pack.completed &&
        pack.yourStars &&
        pack.Lstar !== null &&
        pack.yourLength !== null &&
        pack.yourElapsed !== null
      ) {
        const board = await getBoard(night.date);
        setResult({
          ok: true,
          length: pack.yourLength,
          Lstar: pack.Lstar,
          stars: pack.yourStars,
          elapsedMs: pack.yourElapsed,
          rank: board.you?.rank ?? null,
          total: Math.max(board.rows.length, board.you?.rank ?? 0),
          streak: night.streak,
          title: lineTitle(night.streak.current, pack.yourStars),
          loggedIn: night.loggedIn,
          saved: true,
          shareText: shareLine(pack.yourStars, pack.yourLength, pack.yourElapsed),
          weekStars: 0,
          mapName: null,
        });
        setView('result');
        return;
      }
      setView('play');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The lamps did not catch.');
      setView('error');
    }
  }

  async function finish(path: string[], elapsedMs: number) {
    if (!date) return;
    setLastPath(path);
    setLastElapsed(elapsedMs);
    if (playtest) {
      const playable: Playable = playtest.puzzle;
      const checked = legality(playable, path);
      if (!checked.ok) throw new Error(checked.reason);
      const stars = starsFor(checked.length, playtest.Lstar);
      setFlash(`Home in ${formatLength(checked.length)}. ${stars} star${stars === 1 ? '' : 's'}.`);
      setPlaytest(null);
      setView('editor');
      return;
    }
    const solved = community
      ? await postCommunitySolve(community.id, date, path, elapsedMs)
      : await postSolve(date, path, elapsedMs);
    setResult(solved);
    setSplash((current) =>
      current
        ? { ...current, loggedIn: solved.loggedIn, completed: solved.saved, streak: solved.streak }
        : current
    );
    setView('result');
  }

  async function resign() {
    if (!date || lastPath.length === 0) return;
    const solved = await postSolve(date, lastPath, lastElapsed);
    setResult(solved);
  }

  async function toggleGhost() {
    if (ghost) {
      setGhost(null);
      return;
    }
    const night = await getGhost(date);
    setGhost(night.path);
  }

  async function ride(id: string, name: string) {
    const map = await getCommunityMap(id, date);
    setCommunity({ id, name });
    setCommunityPuzzle(map.puzzle);
    setPlaytest(null);
    setResult(null);
    setGhost(null);
    setView('play');
  }

  async function publish(draft: DraftBody) {
    const posted = await postMap(date, draft);
    setFlash(`${posted.map.name} is on the board.`);
    setView('workshop');
  }

  const active = playtest?.puzzle ?? communityPuzzle ?? puzzle;
  const banner = playtest
    ? 'Playtest. This line is not published yet.'
    : community
      ? `${community.name}. A community line.`
      : undefined;

  return (
    <main className="shell">
      <div className="frame">
        {view === 'load' ? (
          <div className="loading">
            <Lantern />
            <p>Lighting the lamps…</p>
          </div>
        ) : null}
        {view === 'error' ? (
          <div className="empty">
            <p>{error}</p>
            <button type="button" className="primary" onClick={() => void boot()}>
              Try again
            </button>
          </div>
        ) : null}
        {active && (view === 'play' || view === 'result') ? (
          <PlayView
            key={active.id + (playtest ? '-test' : '')}
            puzzle={active}
            date={date}
            banner={banner ?? null}
            ghost={ghost}
            onLeave={
              playtest
                ? () => {
                    setPlaytest(null);
                    setView('editor');
                  }
                : community
                  ? () => {
                      setCommunity(null);
                      setCommunityPuzzle(null);
                      setView('workshop');
                    }
                  : null
            }
            onSolved={finish}
          />
        ) : null}
        {view === 'result' && result ? (
          <ResultCard
            date={date}
            result={result}
            ghostOn={Boolean(ghost)}
            onWorkshop={() => {
              postEvent('workshop_open', date);
              setView('workshop');
            }}
            onGhost={() => void toggleGhost().catch((err: unknown) => setError(err instanceof Error ? err.message : ''))}
            onSigned={resign}
          />
        ) : null}
        {view === 'workshop' && splash ? (
          <WorkshopView
            date={date}
            username={splash.username}
            onBack={() => {
              setCommunity(null);
              setCommunityPuzzle(null);
              setView(result ? 'result' : 'play');
            }}
            onRide={(id, name) => void ride(id, name)}
            onDraw={() => {
              setEditorOn(true);
              setView('editor');
            }}
          />
        ) : null}
        {editorOn ? (
          <div className="fill" hidden={view !== 'editor'}>
            <EditorView
              flash={flash}
              onBack={() => setView('workshop')}
              onPlaytest={(next, optimal) => {
                setPlaytest({ puzzle: next, Lstar: optimal });
                setCommunity(null);
                setCommunityPuzzle(null);
                setView('play');
              }}
              onPublish={publish}
            />
          </div>
        ) : null}
        {view !== 'error' && error ? <p className="hint">{error}</p> : null}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
