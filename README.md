# Owl Line

A daily night-tram puzzle. Every UTC day the city is a little different: a new map, one constraint, and the last car still has to get home. You plot the service, the game scores you against the best possible route, and then you can ride lines other people have drawn.

It is a small game on purpose. You should be moving a tram within a few seconds of opening the post, and a careful night takes a minute or two.

Designed, built and developed by Saddam Malik.
https://saddammalik.com

## How to play

The depot starts lit. Stops you can reach glow. Tap one to extend the line. Tap the stop you are on to take that hop back, or use Undo. Clear starts the night over.

Visit every stop and bring the car back to the depot. The badge on the map is the only rule for that night:

- **Bridge closed.** The dashed crossing with the barrier is out until morning.
- **One-way on the hill.** Follow the arrows.
- **Market first.** Call at the market before the hill.
- **Tight track budget.** Stay under the length on the badge.
- **Works, then home.** The works is the last stop before the depot.

When the route is legal, Complete service lights up. You get stars from the length of track you used, not from a guess:

- **3 stars** means you matched the best route.
- **2 stars** means you were within 10% of it.
- **1 star** means you got everyone home some other legal way.

Shorter track ranks above a faster clock. Your streak counts a finished night and breaks if you miss a UTC day. Share my time posts a spoiler-free line ("Perfect service — 14.2, 1:11. No route.") as you, and only if you ask it to. You can play the whole puzzle logged out. Saving a score, sharing, and the workshop need a login.

After tonight is finished, Yesterday's ghost draws the best route from the previous night. It never shows today's answer.

## The workshop

The workshop opens once you have finished the official night, so it cannot spoil the daily. Place 8 to 12 stops, draw tracks that do not cross, mark a depot, pick one constraint, and playtest it. A map that has no way home cannot be published. The name comes from a fixed list (Harbor Loop, Rain on Line 4, The Hill Shuttle), not from anything you type. You can publish two lines a day, delete your own, and report someone else's. Three reports take a line off the board.

## Running it here

You need Node.js 24.18 or newer.

```bash
npm install
npm test
npm run play:local
```

Then open http://127.0.0.1:5173/ . The splash is the feed card. Ride tonight opens the map. Scores in this preview stay in `.local/` on your machine, under a dispatcher name from the same word list the game uses. `npm test` rebuilds every daily map the generator knows, solves it again, and checks that the stored best length is the real one. `npm run build` is what `devvit upload` will package.

## Running it on Reddit

This is a Devvit Web app: React and Vite for the post, Hono for the server, Redis for the board. `devvit.json` wires the tall splash, the game view, a midnight UTC job, install and deletion triggers, and a moderator menu item, "Post tonight's Owl Line".

```bash
npm run login
npm run dev
```

Playtest needs a Reddit account and a community you moderate. `npm run deploy` uploads a private build, which is the one to install on a small public test community. Do not run `npm run launch` while the hackathon is being judged. That sends the app to public review.

A fresh install posts today's service. The same job runs at 00:00 UTC. If it misses, opening the night builds the puzzle anyway, and the moderator menu can post it.

Devvit Journeys is still a gated beta, so this app does not request that permission. The same moments are counted in Redis under `evt:{date}`: splash, play_start, first_move, solve, abandon, share, workshop_open, workshop_publish.

The type in the splash and the map is Fraunces and Atkinson Hyperlegible, both under the SIL Open Font License. Those licenses are in `assets/fonts/`.

## What the daily actually is

The date is the seed. The same UTC day always builds the same city: stops on two banks of a river, two bridges, and one constraint chosen so a route home exists. The best length comes from an exact search over the tracks, including routes that double back. The server replays whatever path you submit. It does not trust the length or the clock your browser claims.
