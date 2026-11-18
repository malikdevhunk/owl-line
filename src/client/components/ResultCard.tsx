import { useEffect, useState } from 'react';
import type { BoardResponse, SolveResponse } from '../../shared/api';
import { formatClock, formatLength } from '../../shared/score';
import { getBoard, postShare, postSubscribe, signBook, rememberPlayer } from '../lib/api';
import { askToLogIn, onReddit, toast } from '../lib/bridge';

type ResultCardProps = {
  date: string;
  result: SolveResponse;
  onWorkshop: () => void;
  onGhost: () => void;
  ghostOn: boolean;
  onSigned: () => Promise<void>;
};

export function ResultCard({ date, result, onWorkshop, onGhost, ghostOn, onSigned }: ResultCardProps) {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    void getBoard(date)
      .then((next) => {
        if (!cancel) setBoard(next);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [date, result.rank]);

  async function share() {
    setBusy(true);
    try {
      const posted = await postShare(date);
      setNote('Posted under your name.');
      toast(posted.text);
      setConfirm(false);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'The comment did not post.');
    } finally {
      setBusy(false);
    }
  }

  async function saveGuest() {
    setBusy(true);
    try {
      if (onReddit()) {
        askToLogIn();
        setNote('Log in, then complete the service again to pin it.');
        return;
      }
      const session = await signBook();
      rememberPlayer(session.username);
      await onSigned();
      setNote(`Signed as ${session.username}. This night is on the board.`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not sign the book.');
    } finally {
      setBusy(false);
    }
  }

  async function tomorrow() {
    setBusy(true);
    try {
      await postSubscribe();
      setNote('The next map is posted at midnight UTC.');
      toast('See you tomorrow.');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not follow the night service.');
    } finally {
      setBusy(false);
    }
  }

  const stars = [1, 2, 3];

  return (
    <section className="sheet" aria-label="Service complete">
      <h2>Service complete</h2>
      <div className="stars" aria-label={`${result.stars} of 3 stars`}>
        {stars.map((star) => (
          <span key={star} className={star <= result.stars ? 'star on' : 'star'} />
        ))}
      </div>
      <div className="facts">
        <div className="fact">
          <b>{formatLength(result.length)}</b>
          <span>track · best {formatLength(result.Lstar)}</span>
        </div>
        <div className="fact">
          <b>{formatClock(result.elapsedMs)}</b>
          <span>{result.rank ? `#${result.rank} tonight` : 'not on the board'}</span>
        </div>
        <div className="fact">
          <b>{result.saved ? result.streak.current : '–'}</b>
          <span>{result.saved ? `streak · ${result.title}` : 'sign in to save'}</span>
        </div>
        <div className="fact">
          <b>{result.saved ? result.weekStars : '–'}</b>
          <span>stars this week</span>
        </div>
      </div>
      {result.mapName ? <p>{result.mapName}</p> : null}
      {board && board.rows.length > 0 ? (
        <ol className="board-list">
          {board.rows.slice(0, 5).map((row) => (
            <li key={`${row.rank}-${row.username}`} className={row.you ? 'you' : undefined}>
              <span>#{row.rank}</span>
              <span>{row.username}</span>
              <span>{formatLength(row.length)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {note ? <p>{note}</p> : null}
      {confirm ? (
        <div className="actions">
          <p className="share-preview">{result.shareText}</p>
          <button type="button" className="primary" disabled={busy} onClick={() => void share()}>
            Post this comment
          </button>
          <button type="button" className="ghost" onClick={() => setConfirm(false)}>
            Back
          </button>
        </div>
      ) : (
        <div className="actions">
          {result.saved ? (
            <button type="button" className="primary" onClick={() => setConfirm(true)}>
              Share my time
            </button>
          ) : (
            <button type="button" className="primary" disabled={busy} onClick={() => void saveGuest()}>
              {onReddit() ? 'Log in to save' : 'Sign the night book'}
            </button>
          )}
          <button type="button" className="ghost" onClick={onWorkshop}>
            Ride a community line
          </button>
          <button type="button" className="ghost" onClick={onGhost}>
            {ghostOn ? 'Hide yesterday' : "Yesterday's ghost"}
          </button>
          <button type="button" className="ghost" disabled={busy} onClick={() => void tomorrow()}>
            See you tomorrow
          </button>
        </div>
      )}
      <p className="sr">Built and developed by Saddam Malik</p>
    </section>
  );
}
