# Agent instructions — redmatic-homekit

Instructions for AI coding agents (Claude Code, etc.) working in this
repository.

## What this is

Node-RED nodes that expose things as HomeKit accessories through
HAP-NodeJS: a bridge config node, generic nodes (universal, switch,
pseudobutton, stateless programmable switch, tv) fed by messages, and
Homematic-specific nodes (homematic-devices, garage, irrigation) that read
their data from a `ccu-connection` config node of
[node-red-contrib-ccu](https://github.com/rdmtc/node-red-contrib-ccu)
(`../node-red-contrib-ccu` when checked out next to this repo). The main
audience runs it inside [RedMatic](https://github.com/rdmtc/RedMatic) on a
Homematic CCU3/OpenCCU, installed through the Node-RED palette manager.

**Read `ROADMAP.md` before making changes** — the 4.0.0 modernization is in
progress and records decisions (D-n) that constrain the work: no native
modules or binaries anywhere in the dependency tree (D-1), pairings and
accessory identities must survive upgrades (D-4), device mapping is moving
from per-model files to a generic channel mapping (D-5).

## Layout

- `nodes/` — one `.js` (runtime) + `.html` (editor UI, registration, help)
  pair per node type; `nodes/icons/` editor assets. The bridge node owns the
  HAP storage path (`<userDir>/homekit`) and the `hap` handle every other
  node uses via `bridgeConfig.hap`.
- `homematic-devices/` — one module per Homematic device type (file name =
  lower-cased `TYPE`, spaces → `_`), each a class extending
  `homematic-devices/lib/accessory.js` (fluent `addService().get/set/update`
  DSL over `ccu.subscribe`/`setValueQueued`). Many files are one-line
  aliases. `lib/roles.js` + `lib/generic.js` map every device type
  without a module from its paramset descriptions (channel roles);
  `lib/catalogue.js` + `options.json` describe per type what the editor
  offers; `lib/thermostat.js` is the shared setpoint/mode logic of the
  thermostat modules. The editor html renders whatever the catalogue
  endpoint returns — no per-type knowledge lives in the html anymore.
- `test/` — `node --test` unit tests (`*.test.js`); fixtures under
  `test/fixtures/`.
- `tools/` — maintainer scripts, not published (`check-native.js` is the
  D-1 gate run by CI, `smoke-local.sh` installs the packed module into a
  fresh Node-RED and exercises the bridge, `fixtures-from-pydevccu.js`
  regenerates `test/fixtures/devices/`).
- `.github/workflows/` — `ci.yml` (lint, native scan, Node 22/24 ×
  Node-RED 4/5) and `release.yml` (tag `v*` → npm publish with OIDC
  provenance + GitHub release from `CHANGELOG.md`).

## Conventions

- Code style: ESLint 9 flat config + Prettier (4 spaces, 120 cols, single
  quotes). `npm run lint` checks, `npm run format` fixes. Let a failing lint
  stop you. Editor scripts inside `nodes/*.html` are linted via
  eslint-plugin-html.
- CommonJS, Node ≥ 22.12, Node-RED ≥ 4 (primary target: Node-RED 5 on
  Node 24, as shipped by RedMatic 9).
- Versioning: `4.0.0-dev.N` on master until the release gate (ROADMAP task
  13); bump N for every significant change, no tags until release.
- `CHANGELOG.md` follows Keep a Changelog; describe the user-visible change
  and its reason, not commits.
- Roadmap: stable task numbers, never reused. Completed tasks move to
  `roadmap-archive/task-N.md` and get a ✅ in the ROADMAP contents.
- Docs for users are German first (README.md), English second
  (README.en.md). Code, comments, changelog and roadmap stay English.
- Write a `HANDOFF.md` at the end of a working session so work can continue
  elsewhere.

## Reference material

- HmIP device/channel/datapoint definitions: eQ-3's
  [HmIP_Device_Documentation.pdf](https://www.eq-3.de/Downloads/eq3/download%20bereich/hm_web_ui_doku/HmIP_Device_Documentation.pdf).
- Real paramset descriptions: `../node-red-contrib-ccu/paramsets.json` and
  `../hm2mqtt.js/paramsets.json` (the runtime cache format, keyed
  `<iface>/<TYPE>/<FIRMWARE>/<VERSION>/<channelTYPE>/<paramset>`).
- Channel-role mapping precedent: `../hm2mqtt.js/lib/roles.js`.
- CUxD: https://github.com/jens-maus/cuxd/tree/master/docs.
- Homebrew (HB-*) device XMLs: https://github.com/jp112sdl/JP-HB-Devices-addon
  (`src/addon/firmware/rftypes/`).
