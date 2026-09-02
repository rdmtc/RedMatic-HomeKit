# Changelog

Notable changes to redmatic-homekit. Format follows
[Keep a Changelog](https://keepachangelog.com/); entries describe the
user-visible change and the reason, not the commit list (the release notes
append commits automatically).

## Unreleased (4.0.0)

Breaking release. See [ROADMAP.md](ROADMAP.md) for the plan and the
decisions (D-n) referenced below.

### Changed

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
