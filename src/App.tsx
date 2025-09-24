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
  cloneBoard,
  boardHash,
  placeStone,
} from "./game/engine";

/**
 * AnchorHex — a hex-board connection game
 * Rules implemented from user spec:
 * - Board: 8x8 flat-top hex grid in even-q offset (columns aligned vertically; rows appear zig-zag).
 * - Two players: Black and White; Black moves first.
 * - Bases: White base at (row 0, col 4), Black base at (row 7, col 3) — 0-indexed.
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

type Lang = "en" | "zh";

const translations = {
  en: {
    pass: "Pass",
    passTitleHasMoves: "You have legal moves",
    passTitleNoMoves: "Pass (no legal moves)",
    undo: "Undo",
    undoTitle: "Undo (U)",
    restart: "Restart",
    restartTitle: "Restart (R)",
    moveHash: "Move #",
    moveLabel: (n: number) => `Move #${n}`,
    turn: "Turn:",
    chooseHighlighted: "— choose a highlighted cell",
    noLegal: "— no legal moves",
    showWhiteReach: "Show WHITE reach (stones+empties)",
    showBlackReach: "Show BLACK reach (stones+empties)",
    showTerritory: "Show territory (empty-only reach)",
    rulesTitle: "Rules",
    rules: [
      "On your turn, place a stone on any highlighted empty cell (those are the cells that can survive).",
      "A stone survives if it can connect to its base via a path of your stones and empty cells.",
      "After every move, all dead stones for both sides are removed automatically.",
      "The game ends when neither side has any legal move.",
      "Scoring uses area-style: stones + empty territory reachable from your base by empty-only paths and not from the opponent's base.",
    ],
    tipsTitle: "Tips",
    tips: [
      "Use Undo to rethink (keyboard: U), Restart to begin anew (R).",
      "Toggle overlays to understand connectivity and territory formation.",
      "The highlighted legal cells come from reachability to your base across empty cells and your stones.",
    ],
    gameOverWhite: (w: number, b: number) => `Game Over — White wins ${w} : ${b}`,
    gameOverBlack: (w: number, b: number) => `Game Over — Black wins ${b} : ${w}`,
    gameOverDraw: (w: number, b: number) => `Game Over — Draw ${w} : ${b}`,
    newGame: "New Game",
    inspect: "Inspect Board",
    whiteScore: "White score:",
    blackScore: "Black score:",
    stones: "stones",
    territory: "territory",
    white: "WHITE",
    black: "BLACK",
    langToggle: "中文",
    langToggleTitle: "Switch language",
  },
  zh: {
    pass: "过手",
    passTitleHasMoves: "当前有合法落子",
    passTitleNoMoves: "过手（无合法落子）",
    undo: "撤销",
    undoTitle: "撤销 (U)",
    restart: "重新开始",
    restartTitle: "重新开始 (R)",
    movePrefix: "第",
    moveSuffix: "手",
    moveLabel: (n: number) => `第${n}手`,
    turn: "轮到：",
    chooseHighlighted: "— 选择高亮的格子",
    noLegal: "— 无合法落子",
    showWhiteReach: "显示 白方 连通（棋子+空位）",
    showBlackReach: "显示 黑方 连通（棋子+空位）",
    showTerritory: "显示 地盘（仅空位连通）",
    rulesTitle: "规则",
    rules: [
      "轮到你时，在任意高亮的空格落子（这些是可以存活的点）。",
      "若一枚棋子能通过你方棋子与空位的路径连接到你的基地，则它存活。",
      "每一步之后，双方所有不再连到各自基地的棋子会被移除。",
      "当双方都没有合法落子时，对局结束。",
      "计分采用地盘计分：得分 = 棋子数 + 仅从你的基地出发经空位可达且对手不可达的空位数。",
    ],
    tipsTitle: "提示",
    tips: [
      "使用 撤销 重新思考（快捷键 U），使用 重新开始 开启新对局（快捷键 R）。",
      "切换覆盖层以理解连通与地盘的形成。",
      "高亮的合法点来自：通过空位与己方棋子连接到你的基地的可达性。",
    ],
    gameOverWhite: (w: number, b: number) => `对局结束 — 白方胜 ${w} : ${b}`,
    gameOverBlack: (w: number, b: number) => `对局结束 — 黑方胜 ${b} : ${w}`,
    gameOverDraw: (w: number, b: number) => `对局结束 — 平局 ${w} : ${b}`,
    newGame: "新对局",
    inspect: "查看棋局",
    whiteScore: "白方得分：",
    blackScore: "黑方得分：",
    stones: "棋子",
    territory: "地盘",
    white: "白方",
    black: "黑方",
    langToggle: "EN",
    langToggleTitle: "切换语言",
  },
} as const;

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
  const [lang, setLang] = useState<Lang>("en");
  const [board, setBoard] = useState<Cell[][]>(() => makeInitialBoard());
  const [player, setPlayer] = useState<Player>(START_PLAYER);
  const [move, setMove] = useState(1);
  const [, setHistory] = useState<Snapshot[]>([]);
  const [positionHistory, setPositionHistory] = useState<string[]>(() => [
    boardHash(makeInitialBoard()),
  ]);
  const [hovered, setHovered] = useState<{ r: number; c: number } | null>(null);
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
  const tr = translations[lang];

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  }, [lang]);

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

  const onPass = useCallback(() => {
    if (gameOver) return;
    if (anyLegal) return; // cannot pass if you have legal moves
    pushHistory();
    const nextPlayer: Player = player === "WHITE" ? "BLACK" : "WHITE";
    const oppMask = computeLegalMoves(board, nextPlayer, { forbidPositions: forbidSet });
    const oppAny = oppMask.some((row) => row.some(Boolean));
    // Record pass in move counter and history; board unchanged
    setMove((m) => m + 1);
    setPositionHistory((ph) => [...ph, boardHash(board)]);
    if (!oppAny) {
      setGameOver(true);
      return;
    }
    setPlayer(nextPlayer);
  }, [board, player, anyLegal, forbidSet, gameOver, pushHistory]);

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

      // After move, end if neither side has any legal move (no auto-pass)
      const nextForbid = new Set(forbidSet);
      nextForbid.add(boardHash(resolved));
      const wAny = computeLegalMoves(resolved, "WHITE", {
        forbidPositions: nextForbid,
      }).some((row) => row.some(Boolean));
      const bAny = computeLegalMoves(resolved, "BLACK", {
        forbidPositions: nextForbid,
      }).some((row) => row.some(Boolean));
      if (!wAny && !bAny) setGameOver(true);
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
    if (white > black) return tr.gameOverWhite(white, black);
    if (black > white) return tr.gameOverBlack(white, black);
    return tr.gameOverDraw(white, black);
  }, [gameOver, areaScore, tr]);

  const canPass = useMemo(() => !anyLegal && !gameOver, [anyLegal, gameOver]);
  const playerLabel = player === "WHITE" ? tr.white : tr.black;
  const moveLabel = useMemo(() => tr.moveLabel(move), [tr, move]);
  const isZh = lang === "zh";

  return (
    <div className="min-h-screen w-full bg-neutral-100 text-neutral-900 flex flex-col items-center py-6">
      <div className="w-full max-w-5xl px-4">
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">AnchorHex</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={
                canPass
                  ? "px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  : "px-3 py-1.5 rounded-xl bg-neutral-200 text-neutral-500 disabled:opacity-60 disabled:cursor-not-allowed"
              }
              onClick={onPass}
              disabled={!canPass}
              title={anyLegal ? tr.passTitleHasMoves : tr.passTitleNoMoves}
            >
              {tr.pass}
            </button>
            <button
              className="px-3 py-1.5 rounded-xl bg-neutral-700 text-white hover:bg-neutral-800 shadow-sm"
              onClick={undo}
              title={tr.undoTitle}
            >
              {tr.undo}
            </button>
            <button
              className="px-3 py-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
              onClick={onRestart}
              title={tr.restartTitle}
            >
              {tr.restart}
            </button>
            <button
              className="px-3 py-1.5 rounded-xl border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 shadow-sm"
              onClick={() => setLang((l) => (l === "en" ? "zh" : "en"))}
              title={tr.langToggleTitle}
              aria-label={tr.langToggleTitle}
            >
              <span className={isZh ? "font-semibold" : "text-neutral-400"}>中文</span>
              <span className="mx-1 text-neutral-400">/</span>
              <span className={isZh ? "text-neutral-400" : "font-semibold"}>EN</span>
            </button>
          </div>
        </header>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-neutral-600">{moveLabel}</span>
          <span className="text-sm">
            {tr.turn} <b>{playerLabel}</b> {anyLegal ? tr.chooseHighlighted : tr.noLegal}
          </span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showReach.white}
              onChange={(e) => setShowReach((s) => ({ ...s, white: e.target.checked }))}
            />
            {tr.showWhiteReach}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showReach.black}
              onChange={(e) => setShowReach((s) => ({ ...s, black: e.target.checked }))}
            />
            {tr.showBlackReach}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showReach.territory}
              onChange={(e) =>
                setShowReach((s) => ({ ...s, territory: e.target.checked }))
              }
            />
            {tr.showTerritory}
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
                const isHovered = hovered?.r === r && hovered?.c === c;

                // base styling
                const isWBase = v === WHITE_BASE;
                const isBBase = v === BLACK_BASE;

                // Tile fill: consistent, no pale opacity differences
                // Territory tint is independent of legality
                let fill = "#f8fafc"; // neutral base tile
                let fillOpacity = 1;

                if (v === EMPTY) {
                  const inWhiteTerr = showReach.territory && isWhiteTerr;
                  const inBlackTerr = showReach.territory && isBlackTerr;
                  if (inWhiteTerr) fill = "#dbeafe"; // blue-100
                  else if (inBlackTerr) fill = "#ffe4e6"; // rose-100
                  else fill = "#f8fafc";
                }

                let stroke = "#cbd5e1"; // slate-300 (default grid)
                let strokeWidth = 1;

                // Legal, not hovered: gentle accent to read as "enabled"
                const isLegalIdle = v === EMPTY && isLegal && !gameOver;
                if (isLegalIdle) {
                  stroke = "#64748b"; // slate-500
                  strokeWidth = 1.25;
                }

                // Illegal, not hovered: ensure visible on both blue/red territory fills
                const isIllegalIdle = v === EMPTY && !isLegal;
                if (isIllegalIdle) {
                  stroke = "#cbd5e1"; // slate-300
                  strokeWidth = 1;
                }

                // Hover emphasis
                if (v === EMPTY && !gameOver && isHovered) {
                  if (isLegal) {
                    stroke = "#0f172a"; // slate-900 (near-black)
                    strokeWidth = 1.7;
                    // elevate legal on hover (slightly more saturated)
                    if (fill === "#dbeafe") fill = "#bfdbfe"; // blue-200
                    else if (fill === "#ffe4e6") fill = "#fecdd3"; // rose-200
                    else if (fill === "#f8fafc") fill = "#e2e8f0"; // slate-200
                    fillOpacity = 1;
                  }
                }

                return (
                  <g key={`${r}-${c}`}>
                    <polygon
                      points={pts}
                      fill={fill}
                      fillOpacity={fillOpacity}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      onClick={() => tryPlace(r, c)}
                      onMouseEnter={() => setHovered({ r, c })}
                      onMouseLeave={() =>
                        setHovered((h) => (h && h.r === r && h.c === c ? null : h))
                      }
                      style={{
                        cursor:
                          v === EMPTY && isLegal && !gameOver ? "pointer" : "default",
                      }}
                    />

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
                    {tr.whiteScore} <b>{areaScore.white}</b> ({tr.stones}{" "}
                    {areaScore.breakdown.wStones} + {tr.territory}{" "}
                    {areaScore.breakdown.wTerr})
                  </div>
                  <div>
                    {tr.blackScore} <b>{areaScore.black}</b> ({tr.stones}{" "}
                    {areaScore.breakdown.bStones} + {tr.territory}{" "}
                    {areaScore.breakdown.bTerr})
                  </div>
                </div>
                <div className="mt-3 flex gap-2 justify-center">
                  <button
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white"
                    onClick={onRestart}
                  >
                    {tr.newGame}
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-xl bg-neutral-200"
                    onClick={() => setGameOver(false)}
                  >
                    {tr.inspect}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <section className="mt-4 grid sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-white border text-sm leading-relaxed">
            <h2 className="font-semibold mb-1">{tr.rulesTitle}</h2>
            <ul className="list-disc pl-5 space-y-1">
              {tr.rules.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="p-3 rounded-xl bg-white border text-sm leading-relaxed">
            <h2 className="font-semibold mb-1">{tr.tipsTitle}</h2>
            <ul className="list-disc pl-5 space-y-1">
              {tr.tips.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
