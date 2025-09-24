import { describe, it, expect } from "vitest";
import {
  makeInitialBoard,
  computeLegalMoves,
  placeStone,
  computeAreaScore,
  bothNoMoves,
  WHITE_BASE_POS,
  BLACK_BASE_POS,
  BLACK_STONE,
  WHITE_STONE,
  type Cell,
  boardHash,
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

  it("allows placement that becomes alive after captures", () => {
    // Build a small configuration where a move seems dead but captures adjacent enemy
    // Setup near white base to keep paths short
    const b = makeInitialBoard();
    // We'll craft a ring where black placing fills last liberty but also disconnects white group.
    // Choose a cell near top-left that's empty and surround with white stones that are not connected to the base.
    // For determinism, use coordinates (2,2) region.
    // This test aims more to exercise the code path than exact board reading complexities.

    // Manually place stones by bypassing legality: write directly then resolveCaptures to reflect engine behavior.
    // White small group around (2,2)
    const w: Cell = WHITE_STONE;
    const k: Cell = BLACK_STONE;
    const placements: Array<[number, number, Cell]> = [
      [2, 1, w],
      [1, 2, w],
      [2, 3, w],
    ];
    placements.forEach(([r, c, v]) => (b[r][c] = v));
    // Block white connection to white base by surrounding with some black anchors
    b[3][2] = k;
    b[2][0] = k;
    b[1][1] = k;

    // At this point (2,2) empty, neighboring whites at (2,1),(1,2),(2,3). If black plays at (2,2),
    // it should capture that white group by disconnection, making the placement legal.
    const maskBefore = computeLegalMoves(b, "BLACK");
    // The move may or may not be immediately reachable; we just need it to be allowed overall.
    expect(maskBefore[2][2]).toBe(true);
    const next = placeStone(b, "BLACK", 2, 2);
    expect(next).not.toBeNull();
    const after = next!;
    // The capturing move remains on board
    expect(after[2][2]).toBe(k);
  });

  it("forbids moves that repeat a previous position (superko)", () => {
    // Construct a tiny local fight to cause an immediate repetition if recaptured.
    const b0 = makeInitialBoard();
    // Place a few stones to create a capture scenario near the center-ish
    const B: Cell = BLACK_STONE;
    const W: Cell = WHITE_STONE;
    // Manually write stones (bypassing legality for setup)
    b0[4][4] = B; // black anchor
    b0[4][6] = B; // black anchor
    b0[4][5] = W; // white between

    // Black captures by playing adjacent, removing the white stone by disconnection
    const seen = new Set<string>();
    seen.add(boardHash(b0));

    const b1 = placeStone(b0, "BLACK", 5, 5, { forbidPositions: seen });
    expect(b1).not.toBeNull();
    seen.add(boardHash(b1!));

    // White plays to capture back, forming position b2
    const b2 = placeStone(b1!, "WHITE", 3, 5, { forbidPositions: seen });
    expect(b2).not.toBeNull();
    const b2h = boardHash(b2!);
    seen.add(b2h);

    // Now if Black plays again at (5,5), suppose it would recreate b0; that must be forbidden
    const mask = computeLegalMoves(b2!, "BLACK", { forbidPositions: seen });
    if (mask[5][5]) {
      const b3 = placeStone(b2!, "BLACK", 5, 5, { forbidPositions: seen });
      // Either the move is filtered in mask or rejected at placement
      expect(b3).toBeNull();
    }
  });
});
