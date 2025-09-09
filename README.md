<p align="center">
  <img src="public/vite.svg" height="70" alt="AnchorHex" />
</p>

# AnchorHex

AnchorHex is an original two-base connection & territory game played on a 10×10 flat‑top hex grid. Built with **React + TypeScript + Vite**.

## Gameplay Summary

- Two players: Black (first) and White. Each has a fixed base.
- A legal move is an empty cell that can still connect (via a path of your stones + empty cells) back to your base after placement.
- After every move, all stones from both players that no longer connect to their own base are removed (capture by disconnection).
- The game ends when neither player has any legal move.
- Scoring: area style = stones on board + empty cells reachable from your base by empty-only paths and not also reachable from the opponent's base.

## Run Locally

You can run it locally (see below).

## Quick Start

```bash
pnpm install
pnpm dev
```

Visit http://localhost:5173 (default Vite port).

## Scripts

| Command           | Use                                        |
| ----------------- | ------------------------------------------ |
| `pnpm dev`        | Start dev server (HMR)                     |
| `pnpm build`      | Type-check then build production bundle    |
| `pnpm preview`    | Preview production build locally           |
| `pnpm lint`       | Run ESLint                                 |
| `pnpm lint:fix`   | Auto-fix lint issues                       |
| `pnpm typecheck`  | Run TypeScript project references check    |
| `pnpm test`       | Run unit tests (Vitest)                    |
| `pnpm test:watch` | Watch mode tests                           |
| `pnpm ci`         | Composite: lint + typecheck + test + build |

## Architecture

- `src/game/engine.ts` holds pure game logic (board representation, reachability, legality, scoring). This is framework-agnostic and unit-tested.
- `src/App.tsx` renders the interactive board SVG and UI controls.
- Styling uses Tailwind CSS utility classes (configured via `tailwind.config.ts`).

## Testing

Unit tests (Vitest + jsdom) cover core engine behaviors. Add more for edge cases (repetition rules, complex captures) as the rule set evolves.

```bash
pnpm test
```

## Backlog / Ideas

Possible future tweaks:

- Repetition / ko-like rule to prevent infinite cycles
- Allow moves that only become survivable post-capture (currently disallowed)
- Move log & simple coordinate notation
- Simple AI / heuristic opponent
- Export / import game state
- Incremental reachability optimizations
- Accessibility & keyboard navigation per hex
- Mobile / small-screen layout polish

## Formatting & Linting

Prettier + ESLint (flat config). Run:

```bash
pnpm lint
```

An `.editorconfig` file is included for basic editor consistency.

## License

MIT © 2025 Loren Bian

See `LICENSE` for full text.
