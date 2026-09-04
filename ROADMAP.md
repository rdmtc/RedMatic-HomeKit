# RedMatic-HomeKit Roadmap

Planned direction for redmatic-homekit (HAP-NodeJS based Node-RED nodes that
expose Homematic devices and arbitrary Node-RED data as HomeKit accessories).
The overall theme: **make it installable again on RedMatic 9 / current
Node-RED without any binary dependency, move to the current HAP-NodeJS, and
close the device-support gap that has grown since 2021.**

Convention (same scheme as [RedMatic](../redmatic/ROADMAP.md) and
node-red-contrib-ccu): task numbers are stable and never reused. This file
holds only open items — when a task is completed, its content moves to
[roadmap-archive/](roadmap-archive/) (one file per task, e.g. `task-1.md`)
and its line in the contents below gets a ✅ marker linking into the archive.
Decisions are recorded inline as **D-n** and stay here as the record of why
things are the way they are.

Status 2026-09-02 (evening): `4.0.0-dev.4` on master — camera/zigbee
removed, tooling/CI/release pipeline in place, hap-nodejs 2.x migration
done, editor driven by the runtime catalogue, generic channel mapping
(roles + services + editor rows) implemented with 383 device fixtures and
snapshot tests. Open: per-model override review with golden files for the
3.3.0 types, the node fixes of task 9, docs, hardware verification.
Originally (morning): research and planning only, nothing implemented. Last
release is 3.3.0 (npm, 2022-05); last commit 2021-03 (plus one 2022 merge);
the repo carries 142 open issues (2018–2026) and 7 open PRs. Research basis:
this repo, the sibling repos `../redmatic` (9.0.0-dev, zero native modules,
only node-red-contrib-ccu bundled, everything else via palette manager),
`../node-red-contrib-ccu` (4.0.0 released, CI/OIDC release pipeline,
ESLint 9 + Prettier), `../hm2mqtt.js` (3.5.2, channel-role mapping from
paramset descriptions), npm/GitHub metadata of HAP-NodeJS, the pydevccu
device catalogue, and the full issue/PR backlog.

## Contents

**Ground truth**

- [1. Where we stand (3.3.0)](#1-where-we-stand-330)
- [2. Platform targets and decisions](#2-platform-targets-and-decisions)

**Tasks**

- [3. Binary-free install (the RedMatic 9 gate)](#3-binary-free-install-the-redmatic-9-gate)
- [4. Migrate to @homebridge/hap-nodejs 2.x](#4-migrate-to-homebridgehap-nodejs-2x)
- 5. Modernize tooling, CI and release pipeline ✅ [archived](roadmap-archive/task-5.md)
- [6. Tests and device fixtures](#6-tests-and-device-fixtures)
- [7. Device support — generic channel mapping](#7-device-support--generic-channel-mapping)
- [8. Device backlog from issues and PRs](#8-device-backlog-from-issues-and-prs)
- [9. Node fixes and features from the backlog](#9-node-fixes-and-features-from-the-backlog)
- 10. Camera, TV and Zigbee nodes ✅ [archived](roadmap-archive/task-10.md)
- [11. Documentation](#11-documentation)
- [12. Issue and PR triage](#12-issue-and-pr-triage)
- [13. Verify and release 4.0.0](#13-verify-and-release-400)

**Appendix**

- [A. Device gap analysis](#a-device-gap-analysis)
- [B. Open issue snapshot (2026-09-02)](#b-open-issue-snapshot-2026-09-02)

## 1. Where we stand (3.3.0)

- **Stack**: `hap-nodejs 0.4.52` (June 2019, 7 years and two major
  versions behind), `homebridge-camera-ffmpeg 0.1.14` (2018, reaches into
  the plugin's internals via `require('homebridge-camera-ffmpeg/ffmpeg')`),
  `xo 0.24` as the only devDependency. No `engines`, no `node-red.version`,
  no `files` whitelist, no `repository` field. CommonJS throughout.
- **Nodes** (11): bridge (config), homematic-devices, homematic-garage,
  homematic-irrigation, universal, switch, pseudobutton,
  statelessprogrammableswitch, camera, tv, zigbee-devices. ~1800 lines of
  runtime JS in `nodes/`, 790 lines of editor HTML for the device node alone.
- **Device support**: 224 files in `homematic-devices/` (190 distinct device
  types; ~50 of them one-line aliases, e.g. `hmip-etrv-2 → hmip-etrv`), each
  a class extending `homematic-devices/lib/accessory.js` (a small fluent
  `get/set/update/fault` DSL over `ccu.subscribe`/`setValueQueued`). **The
  editor duplicates the list**: `redmatic-homekit-homematic-devices.html`
  carries a hard-coded 211-entry `switch/case` that decides per type which
  channels and option dropdowns the user sees — every new device is a change
  in two places, and a device without a module is silently absent from the
  list (the source of the recurring "device not found" issues #361, #377).
  Device identity in HomeKit is `uuid.generate(<CCU address>)`, services are
  addressed by a per-accessory subtype counter.
- **Zigbee**: 11 adapters in `zigbee-devices/` on top of
  `node-red-contrib-zigbee` (last release 0.21.0, May 2022; depends on
  zigbee-herdsman → serialport, i.e. native code).
- **CI/tooling**: none. `.github/` holds only a probot `no-response.yml`.
  No tests. `create-todo.js` is a leftover helper.
- **Ecosystem**: RedMatic 9 no longer bundles redmatic-homekit and has no
  package manager; the only install path is the Node-RED palette manager
  (`etc/npmrc`: `install-strategy=shallow`, no lockfile, no compiler on the
  CCU). node-red-contrib-ccu 4.0.0 (the data source) is released; its
  `register/deregister/subscribe/unsubscribe/setValueQueued/findIface`,
  `channelNames`, `metadata.devices`, `enabledIfaces`, `values` and the
  `setStatus({ifaceStatus})` callback — everything this package touches —
  are unchanged in 4.x. ccu's Phase 3 refactor plans to split
  `ccu-connection.js`; the API above is what we depend on and should be
  called out there as a consumer contract.
- **Community state**: 22 forks, none with substantive work beyond the open
  PRs; users patch device files by hand on the CCU (`hmip-broll-2.js` via
  `touch`, #361) and share workarounds in issues (#245). Demand is real:
  device requests keep arriving through January 2026 (#377, #375, #374).

## 2. Platform targets and decisions

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | **Zero native modules, zero binaries, zero install scripts** in the whole dependency tree — the package must install through the palette manager on a CCU3 (armv7l musl, no toolchain). Verified feasible, see task 3.                                                                                                                                                                                                                                                                            |
| D-2 | **HAP library = `@homebridge/hap-nodejs` 2.x** (the 1.x/2.x line moved to the scope in June 2025; the unscoped `hap-nodejs` "latest" 0.14.3 is a maintenance branch for old Homebridge). Currently 2.2.3 (2026-08-22), `engines.node ^22 \|\| ^24 \|\| ^26`.                                                                                                                                                                                                                                      |
| D-3 | **Node ≥ 22.12, Node-RED 4 and 5** (`engines` `^22.12 \|\| >=24`, `node-red.version >=4.0.0`). Node 20 is excluded by D-2. RedMatic 9 ships Node 24 / Node-RED 5.                                                                                                                                                                                                                                                                                                                                 |
| D-4 | **Pairings survive the upgrade.** HAP storage stays at `<userDir>/homekit`, bridge UUID stays `uuid.generate(username)`, accessory UUIDs stay `uuid.generate(<CCU address>)`, and existing service subtypes/order are preserved for every device type that exists today. HAP-NodeJS 2.2.0 confirms its on-disk format is unchanged ("existing pairings and accessory data are read exactly as before"). Users must not have to re-pair or rebuild rooms/automations (the pain described in #250). |
| D-5 | **Device mapping becomes generic** (channel type / paramset `CONTROL` hint → HomeKit service), with per-model overrides only where the generic result is wrong. Per-model files stop being the primary mechanism; the editor's hard-coded case table is replaced by data the runtime provides. Details in task 7.                                                                                                                                                                                 |
| D-6 | **Zigbee support is dropped** (decided 2026-09-02, task 10). Its upstream is dead since 2022 and native; it cannot be installed on RedMatic 9 at all. No successor; zigbee2mqtt plus the universal node is the documented alternative.                                                                                                                                                                                                                                                            |
| D-7 | **Camera support is dropped** (decided 2026-09-02, task 10). It needs an `ffmpeg` binary that RedMatic 9 no longer ships and a full rewrite against the `CameraController` API; it is the one component that cannot honour D-1 on the CCU. No successor package is planned; Homebridge/Scrypted are the documented alternatives.                                                                                                                                                                  |
| D-8 | **Same tooling as the sibling repos**: ESLint 9 flat config + Prettier (4 spaces, `eslint-plugin-html` for the editor scripts), `node --test`, GitHub Actions `ci.yml` + tag-driven `release.yml` with npm OIDC provenance, `CHANGELOG.md` (Keep a Changelog), `AGENTS.md` + `CLAUDE.md`, `HANDOFF.md` at session ends. **No Dependabot/Renovate** (maintainer finds them too noisy) — `npm outdated` + GitHub security alerts.                                                                   |
| D-9 | **4.0.0 is a breaking release**, developed as `4.0.0-dev.x` on `master` (redmatic/ccu scheme), tagged and published only after the hardware gate (task 13).                                                                                                                                                                                                                                                                                                                                       |

## 3. Binary-free install (the RedMatic 9 gate)

**Answer to the headline question: yes, it is possible, and it mostly is
already.** Findings (2026-09-02):

- `hap-nodejs 0.4.52` (current) has **no native dependency**: crypto is
  `tweetnacl`/`fast-srp-hap` (pure JS), mDNS is `bonjour-hap` (pure JS,
  `multicast-dns`). The repo's `package-lock.json` has zero `gypfile` /
  `hasInstallScript` entries.
- `@homebridge/hap-nodejs 2.2.3` installs 36 packages with **zero
  `binding.gyp`, zero `.node`, zero install scripts** (verified with a
  scratch install and a scan of every `package.json`). Its deps: ciao
  (mDNS, pure JS), bonjour-hap, dbus-native (pure-JS D-Bus client, only
  used when the `avahi`/`resolved` advertiser is chosen), tweetnacl,
  fast-srp-hap, futoin-hkdf, debug, tslib, source-map-support. 2.2.0
  replaced `node-persist` with a minimal built-in file store.
- The two real binary touchpoints are **ffmpeg** (camera node, via
  `homebridge-camera-ffmpeg`; RedMatic 9 removed the bundled ffmpeg) and
  **serialport** (zigbee node via node-red-contrib-zigbee). Both are
  resolved by D-6/D-7 — see task 10.
- Historic reason users associate this package with binaries: RedMatic ≤ 7
  listed it in its own package manager next to prebuilt packages (#370,
  #173, #149 are all package-manager install failures, obsolete now).

To do:

- Add a CI check that fails on any `gypfile`, `hasInstallScript`,
  `binding.gyp` or `optionalDependencies` in the installed tree (small node
  script, runs after `npm ci`), so D-1 stays true across dependency bumps.
- ✅ Local equivalent verified 2026-09-02 (dev.5 tarball,
  `npm install --install-strategy=shallow --no-package-lock` into a fresh
  Node-RED 5.0.6 user directory on macOS): all node sets load, the bridge
  publishes via ciao, `dns-sd -B _hap._tcp` sees it, the setup-URI
  endpoint answers, storage lands in `<userDir>/homekit`. The same on the
  RedMatic 9 test box is part of task 13.

## 4. Migrate to @homebridge/hap-nodejs 2.x

Mechanical API changes, all located in the codebase (counts from grep):

- `hap.init(<path>)` (3 call sites: bridge, camera, tv) →
  `HAPStorage.setCustomStoragePath(path.join(userDir, 'homekit'))`, called
  once (bridge module).
- `hap.Accessory.Categories.*` (2) → `Categories.*`.
- `new Error(hap.HAPServer.Status.X)` (39 sites, mostly
  `SERVICE_COMMUNICATION_FAILURE` in the accessory base class and garage/
  irrigation nodes) → `new HapStatusError(HAPStatus.X)`; `HAPServer.Status`
  no longer exists.
- `BatteryService` → `Battery`, `Slat` → `Slats` (already identified in
  PR #350).
- `Accessory.publish()` is async now; `setupURI()`, `bridgedAccessories`,
  `getService(<subtype string>)`, `updateCharacteristic`, `setProps`,
  `'identify'` and the callback-style `'get'`/`'set'` characteristic events
  still exist. Prefer `onGet`/`onSet` in new code (the accessory DSL in
  `lib/accessory.js` is the single place to switch).
- Bridge limit: the code refuses at 150, hap-nodejs throws at 149
  (`MAX_ACCESSORIES`); align and turn it into a clear node status. Consider
  a documented "second bridge" recipe (multiple bridge config nodes already
  work by `username`).
- ✅ mDNS: default advertiser is now `ciao`; `advertiser`
  (`auto` / `ciao` / `bonjour-hap` / `avahi`) is exposed in the bridge
  config as a hedge for network setups like the Avahi-reflector crash in
  #348. **mDNS on the two firmwares** (verified over ssh 2026-09-02):
  neither the official CCU3 firmware nor OpenCCU 3.89.8 runs an
  avahi-daemon. OpenCCU builds `BR2_PACKAGE_AVAHI=y` without
  `BR2_PACKAGE_AVAHI_DAEMON`, i.e. only `avahi-autoipd` (link-local
  addressing) and the client libraries ship; on the ova the only sockets
  on UDP 5353 belong to node-red (our ciao responder). `auto` (default)
  probes for a daemon over D-Bus at publish time and uses it when present,
  ciao otherwise — so a future OpenCCU build with the daemon works without
  a config change, and two responders never fight over port 5353.
- Camera: `configureCameraSource()` is gone (see task 10).
- Reference: PR #350 (ptweety, 2022, hap 0.10) did the same migration one
  step earlier — take the deprecation fixes as a checklist, not the commits
  (it is on xo and rewrites every file).

Acceptance: pairing with an existing `<userDir>/homekit` store from 3.3.0
keeps the bridge paired and every accessory in its room (D-4), verified
on hardware in task 13.

## 6. Tests and device fixtures

There are no tests. The accessory DSL makes device modules cheap to test
without Node-RED: a device module needs `node.bridgeConfig.hap`,
`node.bridgeConfig.accessory()`, `node.ccu.{values, channelNames,
subscribe, unsubscribe, setValueQueued, metadata}` and `node.debug/log`.

- **Fake CCU + real HAP**: a ~100-line fake of the ccu-connection surface
  (recording subscriptions and set calls) plus the real
  `@homebridge/hap-nodejs` objects (no publish). `node --test`.
- **Device fixtures**: device and channel descriptions for every type. Two
  sources: node-red-contrib-ccu's `paramsets.json` + hm2mqtt's (134 types,
  from real CCUs) and the pydevccu catalogue (danielperna84/pydevccu,
  `device_descriptions/` + `paramset_descriptions/`, 383 device types,
  updated 2026-08; check its license before vendoring). A CCU dump tool
  like ccu's `tools/paramsets-fetch.js` covers the maintainer's own devices.
- **Instantiation test**: every mapping (task 7) and every remaining
  per-model override is instantiated against its fixture; unhandled
  exceptions in device code are an entire issue class today (#286, #270,
  #179, #295, "Uncaught Exception").
- **Golden files** (D-4 guard): for every device type supported in 3.3.0,
  record the services/characteristics/subtypes the 3.3.0 code produces from
  the fixture, and assert the 4.0.0 mapping produces the same set (the
  "overnight compare" approach hm2mqtt used to prove its rewrite). Any
  intentional difference is listed in the changelog.
- **Node registration smoke test** with `node-red-node-test-helper`: all
  nodes load on Node-RED 4 and 5.

## 7. Device support — generic channel mapping

The gap (appendix A): 193 of the 383 device types in the pydevccu
catalogue have no module; of those, roughly 60 HmIP/HmIPW types released
since 2020 are the ones users ask for. Adding them one file at a time (plus
the HTML case table) is how the project fell behind; the fix is structural.

Design (D-5), following hm2mqtt's `lib/roles.js` (H-21) and
matterbridge-homematic:

1. **Role per channel** from the paramset description's `CONTROL` hint of
   the primary datapoint (`SWITCH.STATE`, `DIMMER.LEVEL`, `BLIND.LEVEL`,
   `DOOR_SENSOR.STATE`, `RHS.STATE`, `BUTTON.SHORT`,
   `HEATING_CONTROL(_HMIP).SETPOINT`, `LOCK.STATE`, `DANGER.STATE`,
   `POWERMETER.POWER`, `WEATHER_TRANSMIT.*`,
   `MOTIONDETECTOR_TRANSCEIVER.MOTION_DETECTION_STATE`, …), channel `TYPE`
   as fallback for the older BidCos types without hints (`MOTION_DETECTOR`,
   `SHUTTER_CONTACT`, `WEATHER`, `SMOKE_DETECTOR*`, `WATER*`, `KEY*`,
   `TILT_SENSOR`, `PRESENCEDETECTOR_TRANSCEIVER`, …), and **datapoint-name
   rules as the third layer** (`TEMPERATURE`, `HUMIDITY`, `LUX`/
   `ILLUMINATION`, `MOTION`, `STATE` on a SWITCH-type channel, `LOWBAT`,
   `UNREACH`) for channels that carry neither — homebrew sensors and CUxD
   wrappers, see the compatibility notes below. node-red-contrib-ccu
   already holds the descriptions in `metadata` and `paramsets.json`.
2. **Role → HomeKit service** table: switch → Switch/Outlet/Lightbulb/Fan/
   Valve (user option, as today), dimmer → Lightbulb with Brightness,
   blind/shutter → WindowCovering (+ `LEVEL_2` → slat tilt), contact →
   ContactSensor, rotary handle → ContactSensor/Window, motion/presence →
   MotionSensor/OccupancySensor (+ LightSensor option, #285), thermostats →
   Thermostat (HM vs HmIP semantics kept from the existing modules; the
   4.5 °C = off convention, #335), lock → LockMechanism (+ Door option),
   smoke → SmokeSensor, water → LeakSensor, weather → Temperature/Humidity/
   LightSensor, energy → Outlet `OutletInUse` + Eve-style characteristics
   later (#114), key/button channels → StatelessProgrammableSwitch (this
   alone covers ~80 remote/wall-button types that never had modules:
   HmIP-WRC2/WRC6/BRC2/KRC4/RC8/WRCC2, HM-PB-_, HM-RC-_), `LOWBAT` /
   `OPERATING_VOLTAGE` → Battery service (optional per device, #134),
   `UNREACH` → per-accessory `StatusFault`/communication error.
3. **HmIP virtual receivers**: first `*_VIRTUAL_RECEIVER` after the
   `*_TRANSMITTER` is the control channel by default; the other receivers
   (`:5`, `:6`) are offered as options (#208, #329). State reads come from
   the transmitter channel where one exists; `WORKING`/`DIRECTION`/
   `ACTIVITY_STATE` drive `PositionState` (as `lib/generic-hmip-blind.js`
   does today).
4. **Per-model overrides** stay as small classes for the genuinely special
   devices: thermostat groups (`HmIP-HEATING`, `HM-CC-VG-1`), BSL LEDs
   (#156), RGBW/DW lights (#147, #163), HmIP-DLD/KeyMatic (lock states,
   error reporting #185), garage-style actuators, HM-Sec-Sir-WM (#118),
   HmIP-MOD-HO (#310), HmIP-SMO light sensor (#285), and the hb/homebrew
   sensor boards. Existing modules are converted, not rewritten: golden
   files (task 6) decide whether the generic path already reproduces them.
5. **Editor**: the device node's `oneditprepare` fetches, per device, the
   channels the runtime found, the roles/services it derived, and the
   available options (accessory type dropdown, SingleAccessory, extra
   sensors) from a new admin endpoint — the 211-entry `switch/case` goes
   away, and unknown devices show up in the list with whatever the generic
   layer found (closes the "device missing from list" class: #361, #377,
   #234, #283, #313, #280…). Keep the existing `devices` config format so
   flows import unchanged; keep channel names as accessory names
   consistently (#102, #233).
6. **CUxD**: CUxD answers `getParamsetDescription` (12 CUxD types cached
   in ccu's `paramsets.json`), and its emulations of real devices carry
   the real hints (`BLIND.LEVEL` on HM-LC-Bl1-SM, `DIMMER.LEVEL` on
   HM-LC-Dim1TPBU-FM, `BUTTON.SHORT/LONG` on HM-RC-19/HM-RC-P1,
   `DOOR_SENSOR.STATE` on HM-Sec-SC) — the generic path maps them from
   their _own_ channel layout, which fixes the wrong-datapoints class
   (#297: today the TYPE string selects the real device's module).
   `WEATHER`/`MOTION_DETECTOR` channels without hints fall to the type
   rule; `WRAPPER` (device 10000, system devices) and `SYSTEM`
   (`EVENT_INTERFACE.TRIGGER`, exec devices) channels cannot be classified
   and get an explicit per-channel "expose as" option (Switch,
   ContactSensor, TemperatureSensor, …) in the editor. Document that the
   CUxD interface is off by default in the ccu connection config (#276,
   #95, #166, #172).

**Compatibility notes (verified 2026-09-02)**

- **Homebrew (HB-\*) devices**: actuators/buttons from the JP-HB-Devices
  addon are copies of official definitions and carry CONTROL hints
  (HB-LC-Sw1PBU-FM: `SWITCH.STATE` + `BUTTON.*`; HB-OU-RGBW-LED-FX:
  `SWITCH.STATE` on a `SIGNAL_LED` channel) → generic. Homebrew _sensors_
  carry none (HB-UNI-Sensor1: `TEMPERATURE`, `HUMIDITY`, `LUX`,
  `AIR_PRESSURE`, custom `Taupunkt`; HB-UNI-Sen-CAP-MOIST: `WEATHER`
  channel with `HUMIDITY` only; BME280 board: `MY_HUMIDITY`) → the
  datapoint-name layer, which is what `hb-uni-sen-wea.js` hand-codes
  today. Values without a HomeKit service (pH, distance, dust, IAQ) stay
  on the universal node. The 13 existing HB modules remain as overrides
  wherever the golden test shows a difference.
- **Existing per-device configs carry over unchanged.** The flow stores
  one `devices` object keyed by CCU address, not by module: `<device>`
  `{disabled}`, `<device>:<ch>` `{disabled, type: 'Outlet'|…}`, virtual
  channels `{enabled}`, pseudo-options `<device>:HumiditySensor` /
  `<device>:SingleAccessory` / `<device>:BoostSwitch` `{disabled}`. The
  generic mapper must offer the **same option names and value lists for
  the same channels** for every 3.3.0 type — part of the golden test in
  task 6 next to services/subtypes (D-4). New options on a channel simply
  take their default for existing configs.

Sequencing: the mapping table is built from the fixture set (task 6)
first, with every 3.3.0 device as a golden test; new devices are then
verified type by type against fixtures and, where hardware exists,
live (maintainer's CCU: 64 device types; issue reporters for the rest).

## 8. Device backlog from issues and PRs

Device types requested in the tracker, most-wanted first (comment counts
in appendix B). With task 7 most of these become fixture verifications
rather than new modules:

- **HmIP-DLD** door lock drive — #328 (28 comments), #330, #377; override
  class (LockMechanism + door state, `LOCK_STATE`/`LOCK_TARGET_LEVEL`).
- **HmIP-DRDI3** DIN-rail dimmer — #333, #374, PR #354.
- **HmIP-BROLL-2 / FROLL-2** — #363, #364, #361 (users hand-create the alias
  today).
- **HmIP-SWDM-2** — #372; **HmIP-TRV-3** — #375; **HmIP-PSM-2** — #358;
  **HmIP-SMI55-2** — #355; **HmIP-eTRV-B-2 R4M** — #357; **HmIP-eTRV-E** —
  #343 / PR #367; **HmIP-eTRV-C-2** — #340; **HmIP-WTH-1** — PR #368;
  **HmIP-SCTH230** — #325 / PR #359; **HmIP-DLS** — #337; **HmIPW-STHD** —
  #341; **HmIP-SRD** rain sensor — #311, #377; **HmIP-DSD-PCB** — #377;
  **HmIP-WRCC2** — #361; **HmIP-FCI1** (exists but "no function", #278).
- BidCos: **HMW-IO-12-Sw14-DR** — #356, #183; **HM-Sen-Wa-Od** — #352;
  **HM-Sen-RD-O** — #279; **HM-ES-TX-WM** — #227; **HM-MOD-EM-8Bit** —
  #170; **HM-Sec-SFA-SM** — #119; **HM-LC-Ja1PBU-FM** slats — #71 (33
  comments); **HM-DW-WM** (#147, 11 comments — today an alias of the plain
  two-channel dimmer, no colour temperature).
- Also from the catalogue, not yet requested but current eQ-3 products:
  HmIP-eTRV-F, HmIP-SWSD-2, HmIP-SMO-2/SMO230-A, HmIP-ASIR(-2/-O) siren,
  HmIP-WGC garage controller, HmIP-ESI energy interface, HmIP-FALMOT-C12 /
  FAL230 floor heating, HmIP-RGBW, HmIP-DRG-DALI, HmIP-STV, HmIP-SFD,
  HmIP-WKP keypad, HmIP-MP3P, HmIP-DLP, HmIPW-SPI/STH/SCTHD/WRC6/DRAP,
  ELV-SH-* boards. Newer 2025/2026 devices (HmIP door lock pro variants,
  cameras, water stop unit) need fresh descriptions from a current OpenCCU.

**Open PRs** (status 2026-09-02 evening): #368 (WTH-1), #367 (eTRV-E),
#359 (SCTH230) and #354 (DRDI3) are **superseded by the generic mapping**
in dev.4 (all four types map without a module — see
`test/fixtures/generic.snapshot.json`); ✅ the DRD3 idea of #353 is
re-implemented on the module in dev.5 (SingleAccessory option, per-output
brightness); ✅ #345 (tv default port) applied in dev.5. **Close at
triage** (task 12): #368/#367/#359/#354/#353 with thanks and a pointer to
the snapshot entries, #351 (zigbee, D-6), #350 (superseded by task 4 — its
checklist was used).

## 9. Node fixes and features from the backlog

Grouped by node, with the issues each item closes. Ordering inside a
group: bugs first.

**homematic-devices / accessory base**

- ✅ Thermostat setpoint resets and "4.5 °C on, not off" after restart
  (#245, #335, #225, #159): `lib/thermostat.js` (dev.6) — setpoint tracked
  on reads and writes, mode write deferred behind a temperature write from
  the same request, off temperature = OFF in every mode; eight modules
  rewired, tests in `test/thermostat.test.js`. Needs the hardware
  confirmation of task 13 (#159 "current temperature not shown" is a
  separate symptom to re-test).
- ✅ Status updates missing/delayed after local or direct-link switching
  (#319, #369, #252, #294): root cause found on hardware 2026-09-04
  (HmIP-PDT on the OpenCCU box) — not a ccu-side event question. Every
  HmIP actuator reports its real output on the `<X>_TRANSMITTER` channel;
  the `<X>_VIRTUAL_RECEIVER` channels are control inputs and only reflect
  their own last command. All modules and the generic layer read state
  from the receiver HomeKit writes to (`:3.LEVEL` on the PDT), so a level
  set through another receiver (program, direct link, the device's own
  key) never reached HomeKit. dev.8: `lib/state-source.js` redirects state
  reads to the transmitter in the accessory base class (writes stay on the
  receiver), covering every module and the generic mapping; tests in
  `test/state-source.test.js`; verified on the PDT. Non-HmIP devices are
  untouched. Remaining part of this item: the BidCos `WORKING`/`stable`
  handling for delayed updates — re-test once a BidCos actuator is on a
  lab box.
- ✅ One unreachable device makes _all_ accessories "No Response" (#312,
  #194): resolved by the hap-nodejs 2.x migration — batched reads get a
  status per characteristic, so the `SERVICE_COMMUNICATION_FAILURE` of an
  unreachable device stays with its own accessory (the desired signal).
  Re-check on hardware in task 13; `StatusFault` instead of an error
  remains an option if the Home app behaves worse than expected.
- Uncaught exceptions in device code (#286, #270, #179, #295) → task 6
  fixture instantiation + try/catch at the mapping boundary.
- Remember last dimmer level on "on" (#195): `LEVEL 1.005` / `OLD_LEVEL`
  semantics as option; HmIP-BDT range (#263).
- Temperature decimals (#321), channel vs device naming (#102, #233),
  Battery service optional (#134), HmIP-SMO split (#285), MOD-HO
  channels (#310), HM-Sec-Key-S two actions (#288), service messages as
  HomeKit faults (#115).

**garage** (#130 with 52 comments, #210, #184, #296, #301, #286; most of
#130 was implemented in 2019 — what remains is the single-impulse door that
auto-closes by itself, asked twice since, and the reversal edge case): make
the door model explicit (single-impulse actuators with direction reversal,
open-contact-only, timed close, obstruction/blocked after timeout, state
from contacts without HomeKit involvement), allow msg-driven state and
plain node in/out as an alternative to Homematic datapoints (#184).

**irrigation** (#267, #45): msg-driven control and status output, duration
handling; consider folding into the Valve type option of the generic
switch mapping.

**universal** (#104, #221, #222, #257, #315, #254, #155): colour lightbulb
(Hue/Saturation/ColorTemperature) preset, characteristic props editable in
the node UI before deploy, configurable Manufacturer/Model/Serial, initial
state query on deploy, SecuritySystem example flow in the help.

**bridge** (#224 label = bridge name, #348 advertiser option, #250 no
re-creation after restart — covered by D-4/golden tests, 149-accessory
limit message).

**pseudobutton / statelessprogrammableswitch / switch** (#223 switch snaps
back, #336 button bridge): verify after migration; document the intended
auto-reset semantics.

**Eve characteristics** (#114, 11 comments): custom characteristics for
power/energy on POWERMETER channels — after 4.0.0.

## 11. Documentation

- ✅ **README German first** (decided 2026-09-02: the CCU has no significant
  user base outside DACH): `README.md` in German, `README.en.md` as the
  English version, same split as RedMatic (written 2026-09-02, dev.5;
  refine with the wiki rewrite). Content: the RedMatic 9
  install path (palette manager, search `redmatic-homekit`), a "what
  changed in 4.0.0" block (pairings kept, zigbee and camera removed,
  Node/Node-RED minimums), and the device-support statement ("any device
  whose channels have a known role, plus the overrides list").
- Inline help for every node: ✅ German inline help written for all nine
  nodes (dev.5); moving it to `locales/` with an English (`en-US`)
  fallback is still open (#112, #100), including the SecuritySystem/colour-light recipes for the universal
  node that today live in issue comments (#254, #104).
- RedMatic wiki `Homekit` page: rewrite for 4.0.0 (external repo
  `rdmtc/RedMatic.wiki`; RedMatic's roadmap task 7 already lists the
  sibling-readme updates).
- `HANDOFF.md` at the end of each working session (sibling convention).

## 12. Issue and PR triage

142 open issues, 7 open PRs (snapshot in appendix B). **First round done
2026-09-02** (comments in German, signed as written by Claude on behalf of
the maintainer): all 7 PRs closed (#345 applied, #353 idea re-implemented,
the rest superseded by the generic mapping or obsolete), 24 issues closed —
zigbee (6), camera (11), install/package manager (4), and the resolved
#248/#209 (hap migration) and #224 (bridge label). 118 issues remain open
for the second round after the release:

- **Device requests** (~40): link to task 7/8; close each once its type is
  verified against a fixture or live, otherwise ask the reporter for a
  description dump (ccu's `paramsets-fetch.js` output).
- **Zigbee** (7) and **camera** (11): close with the D-6/D-7 statement.
- **Install / package manager** (#370, #173, #149, #338): obsolete with
  RedMatic 9 — close with a pointer to the 9.0.0 release notes.
- **Bugs kept** (thermostat, unreach, garage, universal, status updates):
  stay open, mapped to task 9 items; ask for re-tests on 4.0.0-dev.
- **Support questions / example requests** (~30: #331, #303, #308, #336,
  #264, #223, #247, #234, #274, #185, #165, #155, #137, #135, #140, #122,
  #95, #315…): close with the relevant help text once task 11 lands.
- **Meta** (#209/#248 hap 0.5 migration, #112 docs, #102 naming, #208
  virtual channels): close when their task archives.

## 13. Verify and release 4.0.0

Gate before anything is tagged:

**OpenCCU part done 2026-09-02** (OpenCCU 3.89.8 ova at 172.16.23.119,
RedMatic 9.0.0-dev.11, Node 24 / Node-RED 5.0.6, `4.0.0-dev.7` tarball):
install through Node-RED's palette API (`POST /addons/red/nodes` tarball
upload → npm with RedMatic's npmrc, 32 nested pure-JS packages, no
compiler needed), all nine node sets register, a bridge with universal +
switch + pseudobutton nodes publishes on port 51890 via **ciao** (this
OpenCCU build ships only avahi-autoipd, no avahi-daemon — `auto` picked
ciao correctly), the announcement `CCU Smoke Bridge._hap._tcp` is seen by
an mDNS browser on another LAN host, `GET /accessories` and
`PUT /characteristics` (insecure mode, pin as authorization) work from
the Mac, a HomeKit write on the universal node's Lightbulb reaches the
wired switch node and reads back, the pseudobutton fires and resets, HAP
storage lands in `var/homekit/`, the bridge survives a RedMatic restart
with the same identity, and the palette upgrade path (dev.6 → dev.7 +
restart) works. **Found and fixed on the box:** the universal node had
stopped forwarding HomeKit writes after the hap-nodejs migration (dev.7).
The test flow (tab "homekit smoke") and the module are left installed
there.

**Round 2, 2026-09-04** (same box, now RedMatic 9.0.0-alpha.1 with an
HmIP-WRC2 and an HmIP-PDT paired; a `ccu-connection` config node plus a
homematic-devices node added to the smoke bridge): the PDT maps to a
Lightbulb (On/Brightness), the WRC2 to two StatelessProgrammableSwitches
with a Battery service, the CCU's own `HmIP-RCV-50` to a 50-button
accessory (see below). HomeKit → CCU: On/Brightness writes land on
`:3.LEVEL` and the transmitter follows. CCU → HomeKit: **bug found and
fixed (dev.8)** — a level set through another virtual receiver never
reached HomeKit (task 9 item above, `lib/state-source.js`); after the fix
HomeKit follows the transmitter. Two more findings: (1) **fixed (dev.9)**
— when the ccu-connection node is created in the same deploy as the
homematic node, or on a box without cached metadata, the homematic node
published before the ccu node had fetched its device list ("publish 0
devices") and only a restart fixed it; the node now waits until device
list and channel names have arrived and settled (`publishWhenReady`,
test `test/publish-ready.test.js`; an interface without devices, e.g.
VirtualDevices without groups, never pushes a list, so "every interface
has a list" is not a usable criterion), reproduced on both boxes; (2) the virtual
`HmIP-RCV-50` (and BidCos `HM-RCV-50`) of the CCU is exposed as 50
programmable switches by the generic key rule — useful for triggering
HomeKit automations from CCU programs, but noisy by default; **decided
2026-09-04: opt-in** (dev.11, `generic.isOptIn`, editor shows it as an
opt-in row, stored as `{enabled: true}`). Verified again: this OpenCCU
build has no avahi-daemon (`/usr/sbin/avahi-autoipd` only), ciao is used.
**iPhone pairing** (Home app on the same VLAN, 2026-09-04): the bridge
pairs with its pin, the PDT dims from the Home app (writes on `:3`, state
back from `:2`), the PDT's own key toggles the lamp and HomeKit follows,
the WRC2's first button fires a single press — **its second button did
not**: the CCU never delivered `PRESS_SHORT` for `:2`. HmIP key channels
only report presses once the datapoint is declared "in use"
(`reportValueUsage`; the WebUI had done that for `:1` the day before).
Fixed in dev.11: the generic key mapping reports usage for every
`PRESS_SHORT`/`PRESS_LONG` it subscribes (HmIP interfaces only; a report
the CCU rejects with "Transmission is pending" is retried). The HmIP
server accepts the reports at once but the device gets the new channel
configuration only on its next configuration wake-up (`CONFIG_PENDING`
stays 1 until then — key presses alone do not fetch it, a short press of
the device's system button does). Verified: after the config transfer
both WRC2 buttons deliver `ProgrammableSwitchEvent` single presses.
Direct links of the WRC2 to the PDT keep working alongside.

**Charly (real CCU3 firmware 3.89.8 on armv7l, RedMatic 9.0.0-alpha.0),
2026-09-04**: install of the dev.8 tarball through the palette API
(`POST /addons/red/nodes`, multipart tarball) succeeds on armv7l musl, no
`.node`/`binding.gyp` anywhere in `var/node_modules`, all node sets
register, the bridge publishes via ciao (no avahi-daemon on the CCU3
firmware either). HmIPW-DRI16 → 16 ContactSensors, HmIPW-DRS8 → 8
Switches (HmIPW-DRAP has no controllable channel, correctly absent).
DRS8 both ways verified: HomeKit writes land on `:2.STATE`, a CCU-side
write on the second receiver `:3` reaches HomeKit through the transmitter
`:1` (dev.8 fix), and a HomeKit "off" while `:3` is still on snaps back
to "on" — the real output state. iPhone paired to the Charly bridge
(2026-09-04): DRS8 outputs 1 and 3 switched from the Home app, relays
follow. **DRI16 bug found (fixed dev.12)**: the switch on input 1 and the
button on input 5 never changed anything — all 16 inputs are in
`CHANNEL_OPERATION_MODE = KEY_BEHAVIOR` (the factory default), which
sends only `PRESS_SHORT`/`PRESS_LONG` and never `STATE`, so the 3.3.0
contact-sensor mapping could not work on a default-configured DRI16 (and
the presses were not declared "in use"). The node now reads the mode of
every `*_INPUT_TRANSMITTER` channel from its MASTER paramset when
publishing (`channelModes`, cached) and maps KEY_BEHAVIOR ("Taster") →
programmable switch with usage report, SWITCH_BEHAVIOR ("Schalter",
verified: one `PRESS_SHORT` per flip, no STATE) → programmable switch
with single presses only, BINARY_BEHAVIOR ("Binärsensor") → contact,
inactive → nothing; `roles.channelRole` takes the mode, so the generic path (FCI6,
DSD-PCB, MIO16, DRDI3 keys) gets it too. Fixture `HmIPW-DRI16` from the
Charly, tests in `test/dri16.test.js`. Verified: button on input 5 gives
a single and a long press, the switch on input 1 one long press per
closing flip. **Second finding (fixed dev.13)**: a held key is a stream
of `PRESS_LONG` repeats (~3/s, 19 for two flips) that became one HomeKit
long press each; `Accessory.keyEvents()` forwards only the first of a
stream (end: `PRESS_LONG_RELEASE` or 1.5 s gap), shared by the generic
key mapping and the DRI16 module. Note: the input mode is read at publish
time and cached, so a mode change in the WebUI needs a redeploy/restart
of the homematic node.

Still open on hardware:

- Green `ci.yml` (lint, Node 22/24 × Node-RED 4/5, native-module scan).
- Palette-manager install on the RedMatic 9 test box (OpenCCU x86_64 VM
  used for RedMatic task 8) and on real CCU3 hardware (armv7l musl):
  install succeeds shallow and lockfile-free, nodes register, bridge
  publishes, iPhone pairs, accessories appear with names/rooms.
- **Upgrade path** from 3.3.0 on a paired system: pairing kept, rooms/
  automations kept, every previously supported device present with the
  same services (D-4 golden files, then a real Home app check).
- Device verification with the maintainer's CCU (64 types) and reporter
  feedback for the most-wanted types of task 8 (DLD, DRDI3, BROLL-2,
  eTRV-E/C-2/B-2, SWDM-2, TRV-3).
- ✅ npm trusted publisher (OIDC) for `rdmtc/RedMatic-HomeKit` →
  `release.yml` configured on npmjs.com (maintainer, 2026-09-02).
  `release.yml` publishes prerelease versions (`-dev.x`, `-beta.x`) under
  the `next` dist-tag, releases under `latest`.
- Release notes (German, English summary) state the breaking changes:
  scoped hap-nodejs + Node ≥ 22, zigbee node removed, camera node removed
  (D-7), Node-RED 4/5 only, changed device list mechanism.
- Then task 12's mass triage, and a note in the RedMatic wiki/README that
  HomeKit is back for RedMatic 9.

## A. Device gap analysis

Method: the 190 device types in `homematic-devices/` compared with (a) the
134 types in node-red-contrib-ccu's and hm2mqtt's `paramsets.json` (real
CCUs) and (b) the 383 types in the pydevccu catalogue (2026-08).

| Source                       | Types | Supported | Missing |
| ---------------------------- | ----- | --------- | ------- |
| ccu + hm2mqtt paramsets.json | 134   | 91        | 43      |
| pydevccu catalogue           | 383   | 190       | 193     |

Missing types by family (pydevccu): HmIP 53, HmIPW 8, HM 81 (of which ~55
are remotes/push-buttons/displays → StatelessProgrammableSwitch by the
generic key role, 8 are `-Generic`/`X` wildcard descriptions), HMW 5, HB/HBW
homebrew 8, ELV-SH 5, third-party/weather (KS/WS/ASH 550/888, OLIGO,
Alpha-IP) ~15, ZEL (Roto) 11.

HmIP/HmIPW missing, full list: HMIP-WRC2, HmIP-ASIR, HmIP-ASIR-2,
HmIP-ASIR-O, HmIP-BRC2, HmIP-CCU3, HmIP-DLD, HmIP-DLP, HmIP-DLS, HmIP-DRDI3,
HmIP-DRG-DALI, HmIP-DSD-PCB, HmIP-ESI, HmIP-FAL230-C10, HmIP-FALMOT-C12,
HmIP-FWI, HmIP-HAP, HmIP-HDM1, HmIP-HDM2, HmIP-KRC4, HmIP-KRCA, HmIP-LSC,
HmIP-MIO16-PCB, HmIP-MOD-RC8, HmIP-MP3P, HmIP-PMFS, HmIP-PSMCO, HmIP-RC8,
HmIP-RCB1, HmIP-RCV-50, HmIP-RFUSB, HmIP-RGBW, HmIP-SCTH230, HmIP-SFD,
HmIP-SMO-2, HmIP-SMO230-A, HmIP-SRD, HmIP-STV, HmIP-SWSD-2, HmIP-UDI-SMI55,
HmIP-USBSM, HmIP-WGC, HmIP-WGTC, HmIP-WKP, HmIP-WRC6, HmIP-WRCD, HmIP-WRCR,
HmIP-WTH-1, HmIP-eTRV-2 I9F, HmIP-eTRV-B-2 R4M, HmIP-eTRV-C-2, HmIP-eTRV-E,
HmIP-eTRV-F, HmIPW-DRAP, HmIPW-FAL230-C6, HmIPW-FALMOT-C12, HmIPW-SCTHD,
HmIPW-SPI, HmIPW-STH, HmIPW-STHD, HmIPW-WRC6. (Not in pydevccu but
requested: HmIP-BROLL-2, HmIP-FROLL-2, HmIP-SWDM-2, HmIP-TRV-3, HmIP-PSM-2,
HmIP-SMI55-2, HmIP-WRCC2 — need descriptions from a current OpenCCU.)
Infrastructure entries (CCU3, HAP, RFUSB, RCV-50, USBSM) are not devices to
map.

## B. Open issue snapshot (2026-09-02)

142 open, 217 closed. Categories (numbers = issue ids, comment counts in
parentheses where notable):

- **Device requests**: 377, 375, 374, 372, 364, 363, 361(6), 360, 358,
  357, 356, 355, 352, 343, 341, 340, 337, 334 (done: STE2-PCB), 333(4),
  330, 328(28), 327, 325(3), 313 (done: WTH), 311, 298 (done: FSI16), 283
  (done: WTH-B), 280 (done: WHS2), 279, 227, 183, 170, 153 (done: PMSw1-SM),
  151, 147(11), 119, 118(47, module exists since 2019 — verify and close),
  71(33).
- **Thermostat behaviour**: 335, 245(21), 225(9), 159(7).
- **Status/reachability**: 369, 319(5), 312, 252, 194(9), 250(4), 122(11).
- **Garage/irrigation**: 301, 296, 286, 267(8), 210, 184(4), 130(52), 45(4).
- **Universal node**: 321, 315, 257, 254(11), 247, 222, 221, 155, 104(18).
- **Camera**: 347(4), 344(3), 304, 272, 261, 198(6), 162, 158(25), 152,
  132(4), 100.
- **Zigbee**: 305, 302, 270, 266, 230, 142.
- **Options/behaviour**: 332, 329, 310(6), 297, 295, 294, 290, 288, 285,
  278, 276(8), 274, 263, 231(6), 224, 223, 208, 195, 185, 172, 166(5), 163,
  156(10), 134, 114(11), 102, 95.
- **Install/RedMatic-side**: 370, 348, 338, 173, 149, 371.
- **Meta/docs**: 248, 209, 112(4), 233, 234, 115(8).
- **Support/questions**: 331, 308, 303, 336, 264, 179, 165, 140(18), 137,
  135(5).
