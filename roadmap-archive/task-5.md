# Task 5 — Modernize tooling, CI and release pipeline

**✅ done 2026-09-02** (`4.0.0-dev.1`, commit ac55fc9; CI green from
dev.2 on)

- xo 0.24 → ESLint 9 flat config + Prettier (4 spaces, 120 cols), editor
  scripts in `nodes/*.html` linted via eslint-plugin-html; lint burn-down
  of the whole codebase (5 real findings, one unreachable `break`).
- `package.json`: `engines` (`^22.12 || >=24`), `node-red.version`
  (`>=4.0.0`), `files` whitelist (`nodes/`, `homematic-devices/`,
  `CHANGELOG.md`), `repository`/`bugs`/`homepage`, scripts `lint`,
  `format`, `test`, `test:unit`, `check:native`.
- `.github/workflows/ci.yml`: lint + native-dependency scan + `node --test`
  matrix Node 22/24 × Node-RED 4/5. `.github/workflows/release.yml`: tag
  `v*` → `npm publish --provenance` (OIDC trusted publishing) + GitHub
  release with notes from `CHANGELOG.md` via `.github/release-notes.js`
  (copied from node-red-contrib-ccu). **Still to do once, at release
  time: configure the trusted publisher for `redmatic-homekit` on
  npmjs.com** (task 13).
- `tools/check-native.js` — the D-1 gate (fails on gypfile, install
  scripts, `.node` binaries, optionalDependencies in the production tree).
- `CHANGELOG.md` (Keep a Changelog, 4.0.0 section), `AGENTS.md` +
  `CLAUDE.md`, `.editorconfig`, `.gitattributes`, `.prettierrc`,
  `.prettierignore`; `create-todo.js` and the dead probot
  `.github/no-response.yml` removed; lockfile regenerated as v3.
- Tests came with the following tasks: `test/package.test.js` (node sets),
  `test/bridge.test.js` (hap 2.x end-to-end), `test/catalogue.test.js`,
  `test/roles.test.js`, `test/generic.test.js`, helpers `fake-red.js`,
  `fake-ccu.js`, `fixtures.js`, `harness.js`.

Original plan:

Copy the shape of node-red-contrib-ccu (Phase 1 there):

- `package.json`: `engines`, `node-red.version`, `files` whitelist,
  `repository`, `scripts` (`lint`, `format`, `test`, `test:unit`), drop
  `main: none` oddities only if Node-RED tolerates it (it does; keep).
  Remove `create-todo.js`, `.idea` from `.gitignore` → `.editorconfig`,
  `.gitattributes` (`* text=auto eol=lf`).
- xo → **ESLint 9 flat config + Prettier + eslint-plugin-html** (editor
  scripts in `nodes/*.html` get linted too, with `RED`/jQuery globals).
  `no-unused-vars` with `^_` pattern, `allowEmptyCatch`. Burn-down of the
  existing code under the new rules is part of the task.
- `.github/workflows/ci.yml`: lint + test matrix (Node 22/24 × Node-RED
  4/5) + the D-1 native-module scan (task 3).
- `.github/workflows/release.yml`: on tag `v*` → `npm publish --provenance`
  via OIDC trusted publishing, then GitHub release with notes from
  `CHANGELOG.md` (`.github/release-notes.js` from ccu can be copied as is).
  Requires configuring the trusted publisher for `redmatic-homekit` on
  npmjs.com once.
- `CHANGELOG.md` bootstrapped from the 2019–2022 git history + a 4.0.0
  section listing every breaking change (task 13).
- `AGENTS.md` (layout, conventions, "read ROADMAP first") and `CLAUDE.md`
  (`@AGENTS.md`), same as both siblings.
- Delete `.github/no-response.yml` (probot no-response is unmaintained);
  a `stale`/no-response workflow can come back later if wanted.
