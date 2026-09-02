# Changelog

Notable changes to redmatic-homekit. Format follows
[Keep a Changelog](https://keepachangelog.com/); entries describe the
user-visible change and the reason, not the commit list (the release notes
append commits automatically).

## Unreleased (4.0.0)

Breaking release. See [ROADMAP.md](ROADMAP.md) for the plan and the
decisions (D-n) referenced below.

### Added

- **Generic device mapping** (ROADMAP task 7, D-5): Homematic devices
  without a per-type module are now mapped from their channel roles, which
  the runtime derives from the paramset descriptions the CCU reports
  (CONTROL hints, channel types, datapoint names). Switches, dimmers,
  colour lights (HmIP-RGBW), blinds, contacts, rotary handles, motion and
  presence sensors, smoke, water and rain detectors, CO₂ and
  temperature/humidity/light sensors, buttons (as programmable switches),
  HmIP door locks (HmIP-DLD, HmIP-DLS) and batteries get HomeKit services
  without any code; HmIP thermostats, locks, garage modules and blinds
  reuse the existing modules. Covers, among the requested types, HmIP-DLD
  (#328, #330, #377), HmIP-DRDI3 (#333, #374), HmIP-eTRV-E/-C-2/-B-2
  (#343, #340, #357), HmIP-WTH-1, HmIPW-STHD (#341), HmIP-SRD (#311),
  HmIP-DSD-PCB (#377), HmIP-SCTH230 (#325), HmIP-DLS (#337), HmIP-WRC6
  and other wall buttons (#361), HM-LC-Ja1PBU-FM (#71) and HM-Sen-RD-O
  (#279). The editor lists these devices with the same options as the
  hand-written ones (accessory type per channel, SingleAccessory, Battery,
  HumiditySensor/LightSensor, opt-in virtual channels and buttons).
- German inline help for every node in the editor (bridge, homematic,
  switch, pseudobutton, programmable switch, universal, tv; garage and
  irrigation had help before) (#112).
- Test suite with device fixtures for 383 device types (from the pydevccu
  catalogue), role and service snapshots, and an end-to-end harness (fake
  Node-RED and fake ccu-connection against the real HAP-NodeJS).

### Fixed

- HmIPW-DRD3: the three dimmer outputs can be split into one accessory
  per output (`SingleAccessory` off), each named after its channel; the
  brightness bookkeeping is per output instead of shared (PR #353 idea,
  re-implemented on the existing module so the default layout stays
  identical for paired homes).
- TV node: default port stored as a string so Node-RED ≥ 1.3 validates it
  (PR #345, #344).

### Changed

- Bridge mDNS: new **auto** default that advertises through a running
  avahi-daemon (OpenCCU) over D-Bus and falls back to hap-nodejs' own
  responder on hosts without one (official CCU firmware), so both
  firmwares work without configuration; `ciao`, `bonjour-hap` and `avahi`
  can still be forced.
- **HAP library: `hap-nodejs` 0.4.52 (2019) → `@homebridge/hap-nodejs` 2.x**
  (D-2). Pairings, accessory identities and service numbering are kept
  (storage stays in `<userDir>/homekit`, UUIDs are still derived from the
  bridge MAC and the CCU addresses), so controllers do not need to re-pair
  and rooms/automations survive. Internally: `HAPStorage` instead of
  `hap.init`, `Categories`/`HAPStatus`/`HapStatusError` instead of the
  removed `Accessory.Categories`/`HAPServer.Status`, `Battery` instead of
  the removed `BatteryService` (same service UUID), async `publish()`.
- Bridge: the mDNS advertiser is configurable (see above) for network
  setups where the default does not work (#348); the
  accessory limit follows hap-nodejs (149 per bridge) with a hint to use a
  second bridge; the bridge label in the editor shows the bridge name
  (#224). A failed publish now reports the error instead of leaving the
  bridge half-published.
- Homematic device editor: the device list and the per-channel options are
  now served by the runtime (`homematic-devices/options.json` +
  `homematic-devices/lib/catalogue.js`) instead of a 500-line hard-coded
  table inside the editor; the stored configuration format is unchanged.
  Devices that are missing from the list can no longer disagree with what
  the runtime supports. Fixes the two ZEL (Roto) device types, which the
  old editor spelled differently from the runtime and therefore never
  listed. Settings of devices that are temporarily not listed (interface
  down) are kept instead of being dropped on save.
- TV node: uses the accessory `paired`/`unpaired` events instead of the
  removed HAP server events.
- Supported platforms: Node.js ≥ 22.12 and Node-RED ≥ 4 (`engines` and
  `node-red.version` are declared now; the palette manager refuses older
  runtimes instead of failing later).
- Tooling: xo replaced by ESLint 9 + Prettier (also linting the editor
  scripts in the node `.html` files), `node --test` unit tests, GitHub
  Actions CI (lint, Node 22/24 × Node-RED 4/5, native-dependency scan) and a
  tag-driven release workflow with npm provenance. The published package is
  reduced to `nodes/`, `homematic-devices/` and this changelog.
- A guard (`tools/check-native.js`, run in CI) fails the build if any
  production dependency needs a compiler, an install script or ships a
  binary — the package must stay installable on a CCU (ROADMAP D-1).

### Removed

- **Camera node** (`redmatic-homekit-camera`) and the
  `homebridge-camera-ffmpeg` dependency (D-7). It needed an `ffmpeg` binary
  that RedMatic 9 no longer ships and a rewrite against the hap-nodejs 2.x
  `CameraController` API. Use Homebridge with homebridge-camera-ffmpeg or
  Scrypted for cameras. Existing flows keep importing; the node shows up as
  an unknown type and must be deleted.
- **Zigbee node** (`redmatic-homekit-zigbee-devices`) and the
  `zigbee-devices/` adapters (D-6). Its upstream node-red-contrib-zigbee has
  been unmaintained since 2022 and depends on native serialport code that
  cannot be installed on a CCU. zigbee2mqtt plus the universal node is the
  supported way to bring Zigbee devices into HomeKit.
- `create-todo.js` maintainer leftover.
