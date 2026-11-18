import './styles.css';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { SplashResponse } from '../shared/api';
import { getSplash } from './lib/api';
import { openGame, readPostDate } from './lib/bridge';
import { Owl } from './components/Owl';

export function Splash() {
  const [data, setData] = useState<SplashResponse | null>(null);

  useEffect(() => {
    const posted = readPostDate();
    void getSplash(posted ?? undefined)
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const streak = data && data.streak.current > 0 ? `${data.streak.current}-night streak` : null;
  const riders = data && data.riders > 0 ? `${data.riders} out tonight` : 'Be the first car out tonight.';

  return (
    <main className="splash">
      <div className="splash-inner">
        <Owl />
        <p className="eyebrow">Night service</p>
        <h1>Owl Line</h1>
        <p className="tag">Plot the last tram home.</p>
        <p className="date">{data?.longDate ?? 'Tonight'}</p>
        <p className="lede">A new city map, one constraint, and the last car of the night.</p>
        {data ? (
          <div className="ticket">
            <strong>{data.constraintLabel}</strong>
            <span>{data.theme}</span>
          </div>
        ) : null}
        <p className="stat">{streak ? `${streak} · ${riders}` : riders}</p>
        <button type="button" className="ride" onClick={openGame}>
          Ride tonight
        </button>
        <p className="credit">Built and developed by Saddam Malik</p>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
