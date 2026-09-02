# Changelog

Notable changes to redmatic-homekit. Format follows
[Keep a Changelog](https://keepachangelog.com/); entries describe the
user-visible change and the reason, not the commit list (the release notes
append commits automatically).

## Unreleased (4.0.0)

Breaking release. See [ROADMAP.md](ROADMAP.md) for the plan and the
decisions (D-n) referenced below.

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
