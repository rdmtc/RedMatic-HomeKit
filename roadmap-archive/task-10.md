# Task 10 — Camera, TV and Zigbee nodes

**✅ done 2026-09-02** (`4.0.0-dev.0` removal, commit 0cd38ed; TV
migrated in `dev.2`, port fix from PR #345 applied in `dev.4`)

- Zigbee node and `zigbee-devices/` removed (D-6). Camera node and the
  `homebridge-camera-ffmpeg` dependency removed (D-7). README no longer
  advertises them; CHANGELOG states both removals with the alternatives
  (zigbee2mqtt + universal node; Homebridge/Scrypted for cameras).
- TV node kept: pure JS, migrated to hap-nodejs 2.x (accessory
  `paired`/`unpaired` events instead of the removed HAP server events,
  async publish with error status), default port fixed for Node-RED ≥ 1.3
  (PR #345, #344). Maintainer decision 2026-09-02: keep it as a niche
  standalone accessory.

Original plan:

- **Zigbee (D-6, decided: dropped)**: remove
  `redmatic-homekit-zigbee-devices` and `zigbee-devices/`. node-red-contrib-zigbee is dead (0.21.0, 2022),
  depends on native serialport, and cannot be installed on RedMatic 9.
  Closes #305, #302, #270, #266, #230, #142, PR #351. If someone wants a
  Zigbee bridge on a CCU, zigbee2mqtt + the universal node is the
  supported answer (document it).
- **Camera (D-7, decided: dropped)**: remove `redmatic-homekit-camera`
  and the `homebridge-camera-ffmpeg` dependency. The node depends on that
  plugin's internals and on an ffmpeg binary; hap-nodejs 2.x replaced
  `configureCameraSource` with `CameraController` (a rewrite of the 127
  lines plus the ffmpeg process handling that lived in the plugin), and
  RedMatic 9 no longer ships ffmpeg. Point to Homebridge/
  homebridge-camera-ffmpeg or Scrypted in README and release notes.
  Closes #158 (25 comments), #162, #272, #261, #198, #132, #152, #344,
  #347, #304, #100. Flows containing a camera node keep importing (Node-RED
  shows it as an unknown type); mention that in the 4.0.0 notes.
- **TV**: pure JS, small; migrate with task 4 and keep. Take the port fix
  from PR #345 (#344).
