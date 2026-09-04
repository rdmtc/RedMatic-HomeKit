# Handoff — redmatic-homekit 4.0.0 (2026-09-04)

State of the 4.0.0 modernization so work can continue on another machine.
Written by Claude Fable on behalf of hobbyquaker. Read `ROADMAP.md` first
(decisions D-1…D-9, open tasks); completed tasks are in `roadmap-archive/`.

## Where things stand

**4.0.0 is released** (2026-09-04): tag `v4.0.0`, published to npm as
`latest` with provenance by `.github/workflows/release.yml`, GitHub
release with the CHANGELOG section. `master` is at 4.0.0, `npm test`
green (lint, 52 unit tests, native-dependency scan). Next versions:
`4.1.0-dev.N` on master, tag `v4.1.0-dev.N` for a prerelease on the
`next` dist-tag, `v4.1.0` for the release. Only tag when the maintainer
says so. The second issue-triage round is done (ROADMAP task 12): 25
issues remain open, seven of them `awaiting-feedback` on 4.0.0.

History (details in CHANGELOG.md and the roadmap):

- **dev.0–dev.7 (2026-09-02)**: camera/zigbee removed, tooling + CI +
  release pipeline, hap-nodejs 2.x migration (storage path and UUIDs
  unchanged, D-4), runtime-driven editor catalogue, generic channel
  mapping with 383 fixtures + snapshots, golden files for all 190 module
  types, shared thermostat logic, first triage round, universal-node write
  fix found on the OpenCCU box.
- **dev.8 (2026-09-04, hardware round 2)**: HmIP actuators read their
  state from the `<X>_TRANSMITTER` channel instead of the virtual receiver
  HomeKit writes to (`homematic-devices/lib/state-source.js`, applied in
  the accessory base class, so every module and the generic mapping get
  it). Found on an HmIP-PDT: a level set by a program through another
  receiver never reached HomeKit — the root cause of the "status not
  updated after local/direct-link switching" issues. Verified on the PDT
  (OpenCCU) and an HmIPW-DRS8 (real CCU3 firmware). New maintainer tool
  `tools/fixture-from-ccu.js` (fixture from a ccu-connection's cache
  files); real `HmIP-PDT` fixture added.
- **dev.9/dev.10**: the homematic node waits until the ccu-connection's
  device list and channel names have arrived and settled before
  publishing (`publishWhenReady`). Before, a first deploy (new
  ccu-connection in the same deploy, or no cached metadata) published
  "0 devices" until a restart. Note: an interface without devices
  (VirtualDevices without groups) never pushes a list, so "every interface
  has a list" was not a usable criterion. Verified with a cache-less
  start on the Charly.
- **dev.11**: HmIP key channels are declared "in use" via
  `reportValueUsage` (generic key mapping; retried while the CCU answers
  "Transmission is pending" for sleeping battery devices) — without it the
  CCU never forwards `PRESS_SHORT` of a button no program uses (WRC2
  button 2 was silent). The CCU's virtual remote `HmIP-RCV-50`/`HM-RCV-50`
  is opt-in (`generic.isOptIn`, editor row stored as `{enabled: true}`).
  iPhone pairing done on the OpenCCU bridge: pairing, dimming from the
  Home app, the PDT's own key, both WRC2 buttons verified (button 2 after
  the device fetched its new config — a short press of its system button
  forces that).
- **dev.12–dev.14**: HmIP multi-mode inputs (HmIPW-DRI16/DRI32/FIO6,
  HmIP-FCI1/FCI6/DSD-PCB, MIO16, DRDI3 keys) are mapped by their
  `CHANNEL_OPERATION_MODE`, which the node reads from the MASTER paramset
  when publishing (`channelModes`, cached): "Taster" → programmable switch
  (single + long), "Schalter" → programmable switch (one short press per
  flip), "Kontakt" (BINARY_BEHAVIOR) → ContactSensor/Door/Window, inactive
  → nothing. Factory default is "Taster", so 3.3.0's always-contact
  mapping never worked on a default DRI16. A held key is one HomeKit long
  press (`Accessory.keyEvents()` collapses the `PRESS_LONG` repeat stream).
  All verified on the Charly with the attached button and switch in all
  three modes; real `HmIPW-DRI16` fixture from the Charly.

## Working here

```
git clone git@github.com:rdmtc/RedMatic-HomeKit.git && cd RedMatic-HomeKit
npm ci
npm test               # lint + unit tests + native scan (must be green before every commit)
npm run format         # prettier + eslint --fix
tools/smoke-local.sh   # packs, installs shallowly into a fresh Node-RED 5, publishes a bridge (macOS)
UPDATE_SNAPSHOT=1 node --test test/roles.test.js test/generic.test.js test/modules.test.js
                       # after an intentional mapping change (review the diff first)
node tools/fixture-from-ccu.js <ccu_<host>.json> <paramsets.json> <TYPE|ADDRESS>...
                       # fixture from a real CCU (files from a RedMatic box: /usr/local/addons/redmatic/var/)
```

Versioning: `npm version 4.0.0-dev.N --no-git-tag-version` for every
significant change, commit message `4.0.0-dev.N: …`, push. Commits end
with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` line.

Test helpers: `test/helpers/harness.js` (fake Node-RED + bridge + device
node + FakeCcu), `test/helpers/fixtures.js` (`fixtures.ccuFor('HmIP-XYZ')`).
Fixtures come from the MIT-licensed pydevccu catalogue
(`tools/fixtures-from-pydevccu.js`) plus real-CCU fixtures
(`tools/fixture-from-ccu.js`, `source: "ccu/..."` in the file).

## Test hosts

Lab systems, credentials and per-box recipes (Node-RED admin API, tarball
install, JSON-API, logs) live in a **private note outside the repo**
(`~/repos/redmatic-lab.md` on the maintainer's machine) — never put
addresses/credentials into this repo, the wiki or issues. In short: an
OpenCCU 3.89.8 x86_64 VM with an HmIP-WRC2 and an HmIP-PDT, a "Charly"
on the original CCU3 firmware 3.89.8 (armv7l) with HmIPW-DRAP/DRI16/DRS8,
and an OpenCCU on a Pi 4 (aarch64) without radio; all on RedMatic 9
alpha (Node 24, Node-RED 5.0.6, ccu 4.0.0). Both HomeKit boxes carry a
flow tab "homekit smoke" (bridge with insecure mode on, pin `031-45-154`,
port 51890, a `ccu-connection` "CCU lokal" on 127.0.0.1, a
homematic-devices node, universal/switch/pseudobutton nodes) and the
current dev build installed in `var/node_modules`. Node-RED log level on
the OpenCCU box is set to `debug` (etc/settings.json) for the tests.
Neither firmware runs an avahi-daemon; the bridge uses ciao via `auto`.
The maintainer's helper scripts for these boxes are in `~/hk-lab/`
(lib.sh with token/flows/deploy helpers, numbered scripts) — local only.

Hardware results are recorded in ROADMAP task 13 ("Round 2" and
"Charly" paragraphs) and task 9.

## Next steps (ROADMAP order)

1. **Task 13, hardware gate** — done 2026-09-04 on both lab boxes,
   including the **upgrade from a paired 3.3.0** (3.3.0 from npm on the
   Charly, paired, rooms + automation, dev.14 on top: keys, pairing and
   the ids of every unchanged service survived — see ROADMAP task 13).
   Left: device verification against the maintainer's own CCU (64 types)
   before/while upgrading production, reporter feedback for the task 8
   types, a BidCos actuator for the `WORKING`/`stable` part of the
   status-update item. The Charly currently runs the "homekit upgrade"
   tab (bridge `CC:22:3D:5A:0B:33`, port 51891) on dev.15; the old
   "homekit smoke" tab was removed from its flow (its storage files are
   still in `var/homekit`).
2. **Task 9 leftovers (4.1)**: garage door model (#130, #184, #210,
   #301), universal node colour preset and characteristic props in the
   editor (#104, #221, #222), BSM virtual channels (#329), BSL LEDs
   (#156), DW-WM colour temperature (#147), dimmer range (#263).
3. **Task 11**: move the German inline help to `locales/` with an
   English fallback (#112); SecuritySystem recipe (#254); wiki page
   `Homekit` in rdmtc/RedMatic.wiki; a note in the RedMatic README/wiki
   that HomeKit is back for RedMatic 9.
4. **Task 12**: round 2 done; watch the seven `awaiting-feedback` issues
   and new reports against 4.0.0 (fixtures from reporters via
   `tools/fixture-from-ccu.js` input files).
5. **Task 7, optional step 4**: replace modules by the generic path where
   `modules.snapshot.json` proves identical output.
6. **Next release**: `4.1.0-dev.N` on master, tag when the maintainer
   gives the go; CHANGELOG section per version.

## Gotchas

- HmIP `<X>_VIRTUAL_RECEIVER` channels are write targets; state is read
  from the preceding `<X>_TRANSMITTER` (`lib/state-source.js`). A HomeKit
  "off" while another receiver still holds "on" snaps back to "on" — that
  is the real output.
- HmIP key channels stay silent until `reportValueUsage` (or a CCU
  program/link) declares them used; battery devices apply it on their next
  configuration wake-up ("Transmission is pending" / `CONFIG_PENDING`
  until then — a short press of the device's system button forces it;
  ordinary key presses do not). Verified on the WRC2: both buttons fire
  after the transfer.
- `Accessory.addService()` in `lib/accessory.js` appends a running counter
  to the subtype; the generic layer overrides it with channel-index
  subtypes. Existing modules must keep the counter scheme (D-4).
- `SingleAccessory` defaults to **on** for multi-channel devices; virtual
  channels, buttons on actuators and opt-in devices use `{enabled: true}`.
- BidCos devices report `LOWBAT` on mains actuators too; the generic
  battery service is added on BidCos only when the device has no actuator
  role, on HmIP whenever `LOW_BAT` exists.
- hap-nodejs 2.x change events carry `reason` (`write`/`update`/…), not
  the old request context — that is how nodes distinguish HomeKit writes
  from their own updates. The published bridge name gets a 4-hex suffix
  from hap-nodejs ("CCU Smoke Bridge E86F"); identity is the username.
- Insecure HAP access (`allowInsecureRequest`) needs the pin as
  `Authorization` header for writes; reads work without.
- `HAPStorage.setCustomStoragePath` is process-wide and can only be set
  once; `nodes/lib/hap.js` guards it. Tests share one storage path.
- Node-RED rejects a config node whose `name` equals a config node id
  ("Circular config node dependency") — seen with a ccu-connection named
  `localhost` with id `localhost`.
- Fixture file names are looked up case-insensitively (pydevccu spells
  some types in upper case; Linux CI is case-sensitive).
