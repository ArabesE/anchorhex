import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ROWS,
  COLS,
  EMPTY,
  WHITE_STONE,
  BLACK_STONE,
  WHITE_BASE,
  BLACK_BASE,
  makeInitialBoard,
  computeLegalMoves,
  bfsFromBase,
  computeAreaScore,
  bothNoMoves,
  cloneBoard,
  boardHash,
  placeStone,
} from "./game/engine";

/**
 * AnchorHex — a hex-board connection game
 * Rules implemented from user spec:
 * - Board: 10x10 flat-top hex grid in even-q offset (columns aligned vertically; rows appear zig-zag).
 * - Two players: Black and White; Black moves first.
 * - Bases: White base at (row 0, col 4), Black base at (row 9, col 5) — 0-indexed.
 * - A move: place a stone of current player on any EMPTY cell that can SURVIVE.
 *   "Can survive" ⇢ the cell is connected to that player's base via a path consisting only of that player's stones and empty cells.
 * - After each move, remove all DEAD stones for BOTH sides.
 *   A stone is dead if it is NOT connected to its own base via a path of its own stones and empty cells.
 * - End: when neither side has any legal move. Scoring uses AREA-style (Go-like):
 *   score = (number of your stones on board) + (number of empty cells reachable from your base via empty cells only, but NOT from opponent base).
 *
 * Notes:
 * - Legal moves highlight updates every turn.
 * - Undo, Restart supported.
 * - Toggle to visualize territory and reachable regions.
 */

// Types re-exported from engine for clarity
import type { Cell, Player } from "./game/engine";

const START_PLAYER: Player = "BLACK"; // Black plays first by default

// Hex layout (flat-top) sizing
const HEX_R = 26; // radius
const HEX_W = HEX_R * 2;
const HEX_H = Math.sqrt(3) * HEX_R; // flat-top height
const MARGIN = 24;

// (All core rules & engine helpers come from ./game/engine to avoid duplication.)

// Geometry helpers to render flat-top hexes in even-q layout
function hexCenter(r: number, c: number) {
  // columns define x, rows define y; even columns are shifted DOWN by HEX_H/2 (even-q)
  const x = MARGIN + c * (HEX_W * 0.75 + 0) + HEX_R; // 0.75*W = 1.5*R
  const y = MARGIN + r * HEX_H + (c % 2 === 0 ? HEX_H / 2 : 0) + HEX_H / 2;
  return { x, y };
}

function hexPoints(cx: number, cy: number, r = HEX_R): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    pts.push([px, py]);
  }
  return pts.map(([x, y]) => `${x},${y}`).join(" ");
}

// Snapshot for undo
type Snapshot = {
  board: Cell[][];
  player: Player;
  move: number;
};

export default function App() {
  const [board, setBoard] = useState<Cell[][]>(() => makeInitialBoard());
  const [player, setPlayer] = useState<Player>(START_PLAYER);
  const [move, setMove] = useState(1);
  const [, setHistory] = useState<Snapshot[]>([]);
  const [positionHistory, setPositionHistory] = useState<string[]>(() => [
    boardHash(makeInitialBoard()),
  ]);
  const [showReach, setShowReach] = useState<{
    white: boolean;
    black: boolean;
    territory: boolean;
  }>({ white: false, black: false, territory: true });
  const [gameOver, setGameOver] = useState(false);

  const forbidSet = useMemo(() => new Set(positionHistory), [positionHistory]);

  // Legal move mask for current player
  const legalMask = useMemo(
    () => computeLegalMoves(board, player, { forbidPositions: forbidSet }),
    [board, player, forbidSet],
  );

  const anyLegal = useMemo(() => legalMask.some((row) => row.some(Boolean)), [legalMask]);

  // Derived masks for reach / territory visualization
  const whiteStonesReach = useMemo(
    () => bfsFromBase(board, "WHITE", "stones+empties"),
    [board],
  );
  const blackStonesReach = useMemo(
    () => bfsFromBase(board, "BLACK", "stones+empties"),
    [board],
  );
  const whiteEmptyReach = useMemo(
    () => bfsFromBase(board, "WHITE", "emptiesOnly"),
    [board],
  );
  const blackEmptyReach = useMemo(
    () => bfsFromBase(board, "BLACK", "emptiesOnly"),
    [board],
  );

  const territoryMask = useMemo(() => {
    const w: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const b: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== EMPTY) continue;
        const wr = whiteEmptyReach[r][c];
        const br = blackEmptyReach[r][c];
        if (wr && !br) w[r][c] = true;
        if (br && !wr) b[r][c] = true;
      }
    }
    return { w, b };
  }, [board, whiteEmptyReach, blackEmptyReach]);

  const areaScore = useMemo(() => computeAreaScore(board), [board]);

  // Dimensions for SVG
  const width = MARGIN * 2 + (COLS - 1) * (HEX_W * 0.75) + HEX_W;
  const height = MARGIN * 2 + ROWS * HEX_H + HEX_H / 2; // extra for shift

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h, { board: cloneBoard(board), player, move }]);
  }, [board, player, move]);

  const onRestart = useCallback(() => {
    const ib = makeInitialBoard();
    setBoard(ib);
    setPlayer(START_PLAYER);
    setMove(1);
    setHistory([]);
    setPositionHistory([boardHash(ib)]);
    setGameOver(false);
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      const last = h[h.length - 1];
      if (!last) return h;
      setBoard(cloneBoard(last.board));
      setPlayer(last.player);
      setMove(last.move);
      setPositionHistory((ph) => (ph.length > 1 ? ph.slice(0, -1) : ph));
      setGameOver(false);
      return h.slice(0, -1);
    });
  }, []);

  // Place stone if legal
  const tryPlace = useCallback(
    (r: number, c: number) => {
      if (gameOver) return;
      const v = board[r][c];
      if (v !== EMPTY) return;
      if (!legalMask[r][c]) return; // must be survivable

      pushHistory();

      // Use engine placement with superko checking
      const resolved = placeStone(board, player, r, c, { forbidPositions: forbidSet });
      if (!resolved) return; // move illegal due to repetition

      setBoard(resolved);
      const nextPlayer: Player = player === "WHITE" ? "BLACK" : "WHITE";
      setPlayer(nextPlayer);
      setMove((m) => m + 1);
      setPositionHistory((ph) => [...ph, boardHash(resolved)]);

      // Check end condition after state updates (microtask)
      setTimeout(() => {
        const ended = bothNoMoves(resolved);
        if (ended) setGameOver(true);
      }, 0);
    },
    [board, player, legalMask, pushHistory, gameOver, forbidSet],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "u") undo();
      if (e.key.toLowerCase() === "r") onRestart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, onRestart]);

  // Winner text when game over
  const winnerText = useMemo(() => {
    if (!gameOver) return "";
    const { white, black } = areaScore;
    if (white > black) return `Game Over — White wins ${white} : ${black}`;
    if (black > white) return `Game Over — Black wins ${black} : ${white}`;
    return `Game Over — Draw ${white} : ${black}`;
  }, [gameOver, areaScore]);

  return (
    <div className="min-h-screen w-full bg-neutral-100 text-neutral-900 flex flex-col items-center py-6">
      <div className="w-full max-w-5xl px-4">
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">AnchorHex</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white hover:opacity-90"
              onClick={undo}
              title="Undo (U)"
            >
              Undo
            </button>
            <button
              className="px-3 py-1.5 rounded-xl bg-neutral-200 hover:bg-neutral-300"
              onClick={onRestart}
              title="Restart (R)"
            >
              Restart
            </button>
          </div>
        </header>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-neutral-600">Move #{move}</span>
          <span className="text-sm">
            Turn: <b>{player}</b>{" "}
            {anyLegal ? "— choose a highlighted cell" : "— no legal moves"}
          </span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showReach.white}
              onChange={(e) => setShowReach((s) => ({ ...s, white: e.target.checked }))}
            />
            Show WHITE reach (stones+empties)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showReach.black}
              onChange={(e) => setShowReach((s) => ({ ...s, black: e.target.checked }))}
            />
            Show BLACK reach (stones+empties)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showReach.territory}
              onChange={(e) =>
                setShowReach((s) => ({ ...s, territory: e.target.checked }))
              }
            />
            Show territory (empty-only reach)
          </label>
        </div>

        <div className="relative rounded-2xl bg-white shadow p-2 overflow-auto">
          <svg width={width} height={height} className="block">
            {/* board hexes */}
            {Array.from({ length: ROWS }).map((_, r) =>
              Array.from({ length: COLS }).map((__, c) => {
                const { x, y } = hexCenter(r, c);
                const pts = hexPoints(x, y, HEX_R);
                const v = board[r][c];

                const isLegal = legalMask[r][c];
                const isWhiteReach = whiteStonesReach[r][c];
                const isBlackReach = blackStonesReach[r][c];
                const isWhiteTerr = territoryMask.w[r][c];
                const isBlackTerr = territoryMask.b[r][c];

                // base styling
                const isWBase = v === WHITE_BASE;
                const isBBase = v === BLACK_BASE;

                // fill layers
                let fill = "#f8fafc"; // base tile
                if (showReach.territory && v === EMPTY) {
                  if (isWhiteTerr) fill = "#e7f0ff"; // bluish
                  else if (isBlackTerr) fill = "#ffe9e7"; // reddish
                }

                const stroke = "#94a3b8";
                const strokeWidth = 1.25;

                return (
                  <g key={`${r}-${c}`}>
                    <polygon
                      points={pts}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      onClick={() => tryPlace(r, c)}
                      style={{
                        cursor:
                          v === EMPTY && isLegal && !gameOver ? "pointer" : "default",
                      }}
                    />

                    {/* legal move dot */}
                    {v === EMPTY && isLegal && !gameOver && (
                      <circle cx={x} cy={y} r={5} fill="#10b981" opacity={0.9} />
                    )}

                    {/* reach overlays */}
                    {showReach.white && isWhiteReach && (
                      <circle
                        cx={x - 9}
                        cy={y - 9}
                        r={3.5}
                        fill="#3b82f6"
                        opacity={0.7}
                      />
                    )}
                    {showReach.black && isBlackReach && (
                      <circle
                        cx={x + 9}
                        cy={y - 9}
                        r={3.5}
                        fill="#ef4444"
                        opacity={0.7}
                      />
                    )}

                    {/* stones / bases */}
                    {v === WHITE_STONE && (
                      <circle
                        cx={x}
                        cy={y}
                        r={HEX_R * 0.58}
                        fill="#ffffff"
                        stroke="#1f2937"
                        strokeWidth={1.5}
                      />
                    )}
                    {v === BLACK_STONE && (
                      <circle cx={x} cy={y} r={HEX_R * 0.58} fill="#0f172a" />
                    )}
                    {isWBase && (
                      <rect
                        x={x - HEX_R * 0.42}
                        y={y - HEX_R * 0.42}
                        width={HEX_R * 0.84}
                        height={HEX_R * 0.84}
                        rx={6}
                        fill="#ffffff"
                        stroke="#1f2937"
                        strokeWidth={1.5}
                      />
                    )}
                    {isBBase && (
                      <rect
                        x={x - HEX_R * 0.42}
                        y={y - HEX_R * 0.42}
                        width={HEX_R * 0.84}
                        height={HEX_R * 0.84}
                        rx={6}
                        fill="#0f172a"
                      />
                    )}
                  </g>
                );
              }),
            )}
          </svg>

          {gameOver && (
            <div className="absolute inset-2 rounded-xl bg-white/85 backdrop-blur flex items-center justify-center border border-neutral-300">
              <div className="text-center p-4">
                <div className="text-lg font-semibold mb-2">{winnerText}</div>
                <div className="text-sm text-neutral-700">
                  <div>
                    White score: <b>{areaScore.white}</b> (stones{" "}
                    {areaScore.breakdown.wStones} + territory {areaScore.breakdown.wTerr})
                  </div>
                  <div>
                    Black score: <b>{areaScore.black}</b> (stones{" "}
                    {areaScore.breakdown.bStones} + territory {areaScore.breakdown.bTerr})
                  </div>
                </div>
                <div className="mt-3 flex gap-2 justify-center">
                  <button
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white"
                    onClick={onRestart}
                  >
                    New Game
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-xl bg-neutral-200"
                    onClick={() => setGameOver(false)}
                  >
                    Inspect Board
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <section className="mt-4 grid sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-white border text-sm leading-relaxed">
            <h2 className="font-semibold mb-1">Rules (implemented)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                On your turn, place a stone on any <b>highlighted</b> empty cell (those
                are the cells that can survive).
              </li>
              <li>
                A stone survives if it can connect to its base via a path of your stones
                and empty cells.
              </li>
              <li>
                After every move, all dead stones for both sides are removed
                automatically.
              </li>
              <li>The game ends when neither side has any legal move.</li>
              <li>
                Scoring uses area-style: stones + empty territory reachable from your base
                by empty-only paths and not from the opponent's base.
              </li>
            </ul>
          </div>
          <div className="p-3 rounded-xl bg-white border text-sm leading-relaxed">
            <h2 className="font-semibold mb-1">Tips</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Use <b>Undo</b> to rethink (keyboard: <kbd>U</kbd>), <b>Restart</b> to
                begin anew (<kbd>R</kbd>).
              </li>
              <li>Toggle overlays to understand connectivity and territory formation.</li>
              <li>
                The highlighted legal cells come from reachability to your base across
                empty cells and your stones.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
