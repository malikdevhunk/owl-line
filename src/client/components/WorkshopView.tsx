import { useEffect, useState } from 'react';
import { kindLabel } from '../../shared/constraints';
import type { WorkshopCard } from '../../shared/api';
import { deleteCommunity, getWorkshop, reportCommunity } from '../lib/api';

type WorkshopViewProps = {
  date: string;
  username: string | null;
  onBack: () => void;
  onRide: (id: string, name: string) => void;
  onDraw: () => void;
};

export function WorkshopView({ date, username, onBack, onRide, onDraw }: WorkshopViewProps) {
  const [maps, setMaps] = useState<WorkshopCard[] | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancel = false;
    void getWorkshop(date)
      .then((list) => {
        if (cancel) return;
        setMaps(list.maps);
        setError('');
      })
      .catch((err: unknown) => {
        if (cancel) return;
        setError(err instanceof Error ? err.message : 'The workshop is dark.');
      });
    return () => {
      cancel = true;
    };
  }, [date, reload]);

  function load() {
    setReload((value) => value + 1);
  }

  return (
    <div className="stack">
      <header className="top">
        <div>
          <strong>Night workshop</strong>
          <div>Lines other dispatchers drew</div>
        </div>
        <button type="button" className="ghost" onClick={onBack}>Tonight</button>
      </header>
      <div className="row">
        <button type="button" className="primary" onClick={onDraw}>Draw a line</button>
      </div>
      {error ? <p>{error}</p> : null}
      {maps && maps.length === 0 ? <p className="empty">The yard is quiet. Draw the first line.</p> : null}
      {maps?.map((map) => (
        <article key={map.id} className="card">
          <h3>{map.name}</h3>
          <p>
            {map.authorName} · {map.stops} stops · {kindLabel(map.kind)} · {map.plays} rides
          </p>
          <div className="row">
            <button type="button" className="primary" onClick={() => onRide(map.id, map.name)}>
              Ride
            </button>
            {username && map.authorName === username ? (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  void deleteCommunity(map.id).then(() => load());
                }}
              >
                Delete
              </button>
            ) : (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  void reportCommunity(map.id)
                    .then((result) => {
                      setError(result.hidden ? 'That line was taken down.' : 'Report noted.');
                      return load();
                    })
                    .catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : 'Could not report that line.');
                    });
                }}
              >
                Report
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
