This is the Expo / React Native app of the GestiónFelina monorepo (see the root AGENTS.md
and README). It is a client of the same API as the web app and must keep feature parity
with it.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo,
EAS or React Native API, read the major version of `expo` in `package.json` (SDK 58) and
use the matching docs: `https://docs.expo.dev/versions/v58.0.0/` (index with corrections:
https://docs.expo.dev/llms.txt). The installed `.d.ts` files are the source of truth.

## Reuse before writing

- Queries and query keys: `@felina/client/queries` (shared with the web; `src/lib/api.ts`
  registers the client). Formatting, error messages, badge tones, location and proposal
  logic: `@felina/client/*`. Validation: `@felina/schemas/*`. Labels: `@felina/domain/*`.
- Anything platform-agnostic that both apps need goes into `packages/client`, not here.
- Colours come from `packages/theme/tokens.css` (Uniwind classes, `useCSSVariable` in JS).

## Commands (pnpm workspace)

- `vp run dev:mobile` (from the root) or `pnpm dev` here starts Metro for the development
  build; `pnpm dev:go` for Expo Go.
- Add native packages with the SDK's version: `pnpm expo install <pkg>` here (never a
  bare `pnpm add` for native modules).
- `vp check` at the root lints and type-checks this app too; `pnpm typecheck` here.

## Rules

- Routes live in `src/app/` only; screens' parts in `src/screens/`, `src/components/`.
- Third-party components need `withUniwind` for `className` (see `components/ui/image.tsx`,
  `components/ui/safe-area.tsx`).
- Native controls (switch, checkbox, select, segmented, date) come from `@expo/ui`
  through `components/ui/controls.tsx`.
- Lists show skeletons while their query is fetching, never stale results (as on the web).
- `ios/` and `android/` are generated (CNG, gitignored): configure native behaviour in
  `app.json` (static) or `app.config.ts` (values from the environment). Builds are local
  (`pnpm android`, `pnpm ios`, `*:device`, `*:release`), not EAS.
- A native module not bundled in Expo Go only works in the development build: check
  before adding one, and rebuild (`pnpm android` / `pnpm ios`) after installing it.
