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

## Demo

You can run it locally (see below) or deploy easily to GitHub Pages / Netlify / Vercel.

### Deploy (GitHub Pages via Actions)

1. Enable GitHub Pages (Settings → Pages → Build from `gh-pages` branch).
2. Add a simple deploy script (example):

```jsonc
// package.json scripts excerpt
"predeploy": "pnpm build",
"deploy": "git subtree push --prefix dist origin gh-pages"
```

3. Or use an Action like `peaceiris/actions-gh-pages` after `pnpm build`.

For Netlify / Vercel just point build to `pnpm build` and publish directory `dist`.

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

Non-exhaustive list of things I might add later:

- Repetition / ko-like rule to prevent infinite cycles
- Enhanced legality: allow moves that become survivable only after captures (current engine forbids pre-capture self-atari that would resolve)
- Move log & simple coordinate notation
- AI / heuristic opponent (e.g. Monte Carlo playouts or pattern heuristics)
- Export / import game state (string notation or JSON)
- Territory / reachability performance optimizations (memoize incremental diffs)
- Accessibility & keyboard navigation per hex cell
- Mobile layout & responsive sizing improvements

Treat this as a personal sandbox; no PRs expected.

## Formatting & Linting

Prettier + ESLint (flat config) are used. Run:

```bash
pnpm lint
```

An `.editorconfig` file is included for basic editor consistency.

## Contributing

Not open for external contributions at this time.

## License

MIT © 2025 Loren Bian

See `LICENSE` for full text.
