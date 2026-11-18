import { useMemo, useState, type PointerEvent } from 'react';
import { EDITOR_RIVER } from '../../shared/generate';
import { kindLabel } from '../../shared/constraints';
import { presentPuzzle, type PublicPuzzle } from '../../shared/present';
import { anySegmentsCross } from '../../shared/geometry';
import type { ConstraintKind, District, DraftBody } from '../../shared/types';
import { realizeDraft } from '../../shared/workshop';
import { MapBoard } from './MapBoard';

const KINDS: ConstraintKind[] = ['bridge_closed', 'one_way', 'market_first', 'short_budget', 'works_last'];
const DISTRICTS: District[] = ['depot', 'market', 'harbor', 'hill', 'works', 'stop'];

type EditorViewProps = {
  onBack: () => void;
  onPlaytest: (puzzle: PublicPuzzle, optimal: number) => void;
  onPublish: (draft: DraftBody) => Promise<void>;
  flash?: string;
};

type DraftNode = { id: string; x: number; y: number; district: District };

export function EditorView({ onBack, onPlaytest, onPublish, flash = '' }: EditorViewProps) {
  const [nodes, setNodes] = useState<DraftNode[]>([]);
  const [edges, setEdges] = useState<{ id: string; a: string; b: string }[]>([]);
  const [tool, setTool] = useState<'place' | 'track'>('place');
  const [selected, setSelected] = useState<string | null>(null);
  const [arm, setArm] = useState<string | null>(null);
  const [kind, setKind] = useState<ConstraintKind>('short_budget');
  const [note, setNote] = useState('Place 8 to 10 stops, then draw the tracks.');
  const [seenFlash, setSeenFlash] = useState(flash);
  if (flash !== seenFlash) {
    setSeenFlash(flash);
    if (flash) setNote(flash);
  }
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const draft = useMemo<DraftBody>(() => ({ nodes, edges, kind }), [nodes, edges, kind]);

  const preview = useMemo<PublicPuzzle>(() => {
    const named = nodes.map((node, index) => ({
      ...node,
      name: node.district === 'stop' ? `Stop ${index + 1}` : node.district,
    }));
    return {
      id: 'draft',
      date: null,
      nodes: named,
      edges: edges.map((edge) => ({ ...edge, w: 1, bridge: false, closed: false, oneWay: null })),
      river: EDITOR_RIVER,
      constraint: { kind: 'short_budget', budget: 9999 },
      required: nodes.map((node) => node.id),
      depotId: nodes.find((node) => node.district === 'depot')?.id ?? nodes[0]?.id ?? 'n0',
      theme: 'Workshop',
      mapName: null,
      authorName: null,
    };
  }, [nodes, edges]);

  function place(event: PointerEvent<HTMLDivElement>) {
    if (tool !== 'place' || nodes.length >= 10) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round((((event.clientX - rect.left) / rect.width) * 1000) / 10) * 10;
    const y = Math.round((((event.clientY - rect.top) / rect.height) * 1000) / 10) * 10;
    if (x < 60 || y < 60 || x > 940 || y > 940) return;
    if (nodes.some((node) => Math.hypot(node.x - x, node.y - y) < 80)) {
      setNote('Leave a little paper between stops.');
      return;
    }
    const id = `n${nodes.length}`;
    const district: District = nodes.length === 0 ? 'depot' : 'stop';
    setNodes((current) => [...current, { id, x, y, district }]);
    setSelected(id);
    setReady(false);
  }

  function tap(id: string) {
    setSelected(id);
    if (tool !== 'track') return;
    if (!arm) {
      setArm(id);
      setNote('Tap the stop this track runs to.');
      return;
    }
    if (arm === id) {
      setArm(null);
      return;
    }
    const a = nodes.find((node) => node.id === arm);
    const b = nodes.find((node) => node.id === id);
    if (!a || !b) return;
    const next = [...edges, { id: `e${edges.length}`, a: arm, b: id }];
    const pairs = next.flatMap((edge) => {
      const from = nodes.find((node) => node.id === edge.a);
      const to = nodes.find((node) => node.id === edge.b);
      return from && to ? [{ a: from, b: to }] : [];
    });
    if (anySegmentsCross(pairs)) {
      setNote('Tracks may not cross.');
      setArm(null);
      return;
    }
    const crowded = nodes.some((node) => next.filter((edge) => edge.a === node.id || edge.b === node.id).length > 4);
    if (crowded) {
      setNote('Four tracks is the limit at a stop.');
      setArm(null);
      return;
    }
    setEdges(next);
    setArm(null);
    setReady(false);
    setNote('Track laid.');
  }

  function setDistrict(district: District) {
    if (!selected) return;
    setNodes((current) =>
      current.map((node) => {
        if (district === 'depot' && node.district === 'depot') return { ...node, district: 'stop' };
        if (node.id === selected) return { ...node, district };
        return node;
      })
    );
    setReady(false);
  }

  function playtest() {
    const realized = realizeDraft(draft, Math.random);
    if (!realized.ok) {
      setNote(realized.error);
      setReady(false);
      return;
    }
    setReady(true);
    setNote('This night has a way home.');
    onPlaytest(presentPuzzle(realized.puzzle), realized.puzzle.Lstar);
  }

  async function publish() {
    setBusy(true);
    try {
      await onPublish(draft);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not publish.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <header className="top">
        <div>
          <strong>Draw a line</strong>
          <div>{nodes.length}/10 stops · {edges.length} tracks</div>
        </div>
        <button type="button" className="ghost" onClick={onBack}>Back</button>
      </header>
      <div className="tools">
        <button type="button" className="ghost" aria-pressed={tool === 'place'} onClick={() => setTool('place')}>
          Place
        </button>
        <button type="button" className="ghost" aria-pressed={tool === 'track'} onClick={() => setTool('track')}>
          Track
        </button>
        {DISTRICTS.map((district) => (
          <button key={district} type="button" className="ghost" onClick={() => setDistrict(district)}>
            {district}
          </button>
        ))}
      </div>
      <div className="tools">
        {KINDS.map((item) => (
          <button
            key={item}
            type="button"
            className="ghost"
            aria-pressed={kind === item}
            onClick={() => {
              setKind(item);
              setReady(false);
            }}
          >
            {kindLabel(item)}
          </button>
        ))}
      </div>
      <p>{note}</p>
      <div className="stage" onPointerDown={place}>
        {nodes.length > 0 ? (
          <MapBoard puzzle={preview} path={[]} legal={arm ? [arm] : []} illegalId={null} ghost={null} onTap={tap} />
        ) : (
          <div className="board" />
        )}
      </div>
      <div className="row">
        <button type="button" className="ghost" onClick={playtest}>Playtest</button>
        <button type="button" className="primary" disabled={!ready || busy} onClick={() => void publish()}>
          Publish
        </button>
      </div>
    </div>
  );
}
