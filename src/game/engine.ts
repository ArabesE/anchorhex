// Core game engine logic for AnchorHex (no React / DOM), enabling unit tests.

export const ROWS = 10;
export const COLS = 10;

export const EMPTY = 0 as const;
export const WHITE_STONE = 1 as const;
export const BLACK_STONE = 2 as const;
export const WHITE_BASE = 3 as const;
export const BLACK_BASE = 4 as const;

export type Cell = 0 | 1 | 2 | 3 | 4;
export type Player = "BLACK" | "WHITE";

export const WHITE_BASE_POS = { r: 0, c: 4 } as const;
export const BLACK_BASE_POS = { r: ROWS - 1, c: 5 } as const;

export function cloneBoard(b: Cell[][]): Cell[][] {
  return b.map((row) => row.slice());
}

export function makeInitialBoard(): Cell[][] {
  const board: Cell[][] = Array.from({ length: ROWS }, () =>
    Array<Cell>(COLS).fill(EMPTY)
  );
  board[WHITE_BASE_POS.r][WHITE_BASE_POS.c] = WHITE_BASE;
  board[BLACK_BASE_POS.r][BLACK_BASE_POS.c] = BLACK_BASE;
  return board;
}

const ODD_Q_DIRS: Array<[number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [0, 1],
];
const EVEN_Q_DIRS: Array<[number, number]> = [
  [1, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export function inBounds(r: number, c: number) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}
export function neighbors(r: number, c: number) {
  const dirs = c % 2 === 0 ? EVEN_Q_DIRS : ODD_Q_DIRS;
  const out: Array<[number, number]> = [];
  for (const [dc, dr] of dirs) {
    const nr = r + dr,
      nc = c + dc;
    if (inBounds(nr, nc)) out.push([nr, nc]);
  }
  return out;
}

export function playerStone(p: Player) {
  return p === "WHITE" ? WHITE_STONE : BLACK_STONE;
}
export function playerBase(p: Player) {
  return p === "WHITE" ? WHITE_BASE : BLACK_BASE;
}
export function playerBasePos(p: Player) {
  return p === "WHITE" ? WHITE_BASE_POS : BLACK_BASE_POS;
}

export function bfsFromBase(
  board: Cell[][],
  player: Player,
  mode: "stones+empties" | "emptiesOnly"
): boolean[][] {
  const vis = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const q: Array<[number, number]> = [];
  const { r: br, c: bc } = playerBasePos(player);
  vis[br][bc] = true;
  q.push([br, bc]);
  const base = playerBase(player);
  while (q.length) {
    const [r, c] = q.shift()!;
    for (const [nr, nc] of neighbors(r, c)) {
      if (vis[nr][nc]) continue;
      const v = board[nr][nc];
      if (mode === "stones+empties") {
        if (v === EMPTY || v === base || v === playerStone(player)) {
          vis[nr][nc] = true;
          q.push([nr, nc]);
        }
      } else if (mode === "emptiesOnly") {
        if (v === EMPTY) {
          vis[nr][nc] = true;
          q.push([nr, nc]);
        }
      }
    }
  }
  return vis;
}

export function computeLegalMoves(
  board: Cell[][],
  player: Player
): boolean[][] {
  const reach = bfsFromBase(board, player, "stones+empties");
  return reach.map((row, r) => row.map((ok, c) => ok && board[r][c] === EMPTY));
}

export function resolveCaptures(board: Cell[][]): Cell[][] {
  const wReach = bfsFromBase(board, "WHITE", "stones+empties");
  const bReach = bfsFromBase(board, "BLACK", "stones+empties");
  const next = cloneBoard(board);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (v === WHITE_STONE && !wReach[r][c]) next[r][c] = EMPTY;
      if (v === BLACK_STONE && !bReach[r][c]) next[r][c] = EMPTY;
    }
  return next;
}

export function computeAreaScore(board: Cell[][]) {
  const wEmpty = bfsFromBase(board, "WHITE", "emptiesOnly");
  const bEmpty = bfsFromBase(board, "BLACK", "emptiesOnly");
  let wStones = 0,
    bStones = 0,
    wTerr = 0,
    bTerr = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (v === WHITE_STONE) wStones++;
      else if (v === BLACK_STONE) bStones++;
      else if (v === EMPTY) {
        const wr = wEmpty[r][c];
        const br = bEmpty[r][c];
        if (wr && !br) wTerr++;
        else if (br && !wr) bTerr++;
      }
    }
  return {
    white: wStones + wTerr,
    black: bStones + bTerr,
    breakdown: { wStones, bStones, wTerr, bTerr },
  };
}

export function bothNoMoves(board: Cell[][]) {
  const any = (mask: boolean[][]) => mask.some((row) => row.some(Boolean));
  return (
    !any(computeLegalMoves(board, "WHITE")) &&
    !any(computeLegalMoves(board, "BLACK"))
  );
}

export function placeStone(
  board: Cell[][],
  player: Player,
  r: number,
  c: number
) {
  if (board[r][c] !== EMPTY) return null;
  const legal = computeLegalMoves(board, player);
  if (!legal[r][c]) return null;
  const next = cloneBoard(board);
  next[r][c] = playerStone(player);
  return resolveCaptures(next);
}

export type AreaScore = ReturnType<typeof computeAreaScore>;
