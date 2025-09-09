import { describe, it, expect } from "vitest";
import {
  makeInitialBoard,
  computeLegalMoves,
  placeStone,
  computeAreaScore,
  bothNoMoves,
  WHITE_BASE_POS,
  BLACK_BASE_POS,
} from "./engine";

describe("AnchorHex engine", () => {
  it("initial board has legal moves for black", () => {
    const board = makeInitialBoard();
    const mask = computeLegalMoves(board, "BLACK");
    const any = mask.some((r) => r.some(Boolean));
    expect(any).toBe(true);
  });

  it("placing a legal stone returns a new board", () => {
    const board = makeInitialBoard();
    // find first legal for black
    const mask = computeLegalMoves(board, "BLACK");
    outer: for (let r = 0; r < mask.length; r++) {
      for (let c = 0; c < mask[0].length; c++) {
        if (mask[r][c]) {
          const next = placeStone(board, "BLACK", r, c);
          expect(next).not.toBeNull();
          break outer;
        }
      }
    }
  });

  it("area score counts bases as neither territory nor stones", () => {
    const board = makeInitialBoard();
    const score = computeAreaScore(board);
    expect(score.breakdown.wStones).toBe(0);
    expect(score.breakdown.bStones).toBe(0);
  });

  it("game not over initially", () => {
    const board = makeInitialBoard();
    expect(bothNoMoves(board)).toBe(false);
  });

  it("bases positioned correctly", () => {
    expect(WHITE_BASE_POS.c).not.toBe(BLACK_BASE_POS.c);
  });
});
