# RedMatic HomeKit

[![NPM version](https://badge.fury.io/js/redmatic-homekit.svg)](http://badge.fury.io/js/redmatic-homekit)
[![CI](https://github.com/rdmtc/RedMatic-HomeKit/actions/workflows/ci.yml/badge.svg)](https://github.com/rdmtc/RedMatic-HomeKit/actions/workflows/ci.yml)

> Node-RED nodes that expose Homematic devices and arbitrary Node-RED data
> as HomeKit accessories (HAP-NodeJS). Made for RedMatic on the CCU3 /
> OpenCCU, works in any Node-RED installation.

_[Deutsche Version](README.md) — the German README is the primary one._

> **Version 4.0.0 is under development** (`4.0.0-dev.x`, not released
> yet). See the [changelog](CHANGELOG.md) for what changes compared to
> 3.3.0 and the [roadmap](ROADMAP.md) for the plan.

## Features

- **Homematic devices in HomeKit, automatically** — through a
  [node-red-contrib-ccu](https://github.com/rdmtc/node-red-contrib-ccu)
  connection: switches, dimmers, colour lights, blinds and shutters,
  thermostats, door/window contacts, rotary handles, motion and presence
  sensors, smoke, water and rain detectors, temperature/humidity/light
  sensors, CO₂ sensors, push buttons and remotes (as programmable
  switches), door locks (HmIP-DLD, KeyMatic), garage modules and battery
  levels. Per device and channel the editor lets you choose whether and as
  what (outlet, light, fan, valve, door, window, …) a channel appears.
- **Universal node** for any HomeKit accessory (every HAP service and
  characteristic) driven by Node-RED messages — system variables, MQTT,
  zigbee2mqtt, Hue, anything that arrives in Node-RED.
- **Switch**, **pseudobutton** (auto-resetting switch that emits a
  message), **stateless programmable switch** (button events from
  messages), **garage** and **irrigation** on top of Homematic actuators
  and contacts, **TV** (standalone television accessory with the Control
  Center remote).

## Installation

**RedMatic 9 (CCU3 / OpenCCU):** open _Manage palette → Install_ in the
Node-RED editor, search for `redmatic-homekit`, install. No native modules
or binaries are needed.

**Other Node-RED installations:** `npm install redmatic-homekit` in the
Node-RED user directory (`~/.node-red`). Requires Node.js ≥ 22.12 and
Node-RED ≥ 4.

Quick start: create a **homekit bridge** config node (MAC and PIN are
suggested; after deploying, the node shows the pairing QR code), wire the
**homematic** node to your CCU connection and the bridge, select devices
and channels, deploy, then add the bridge in the Home app by scanning the
QR code. One bridge holds up to 149 accessories; use a second bridge node
(different MAC and port) for more.

## Device support

Since 4.0.0 devices are no longer recognised from a fixed list only. For
every channel the node derives a role from the device description the CCU
reports (the `CONTROL` hints, the channel type and the datapoint names)
and maps it to the matching HomeKit service. Devices released after this
version, homebrew (HB-\*) devices and CUxD devices work as long as their
channels match a known role. About 190 device types keep dedicated modules
(thermostat logic, blinds with slats, HmIP-BSL LEDs, sirens, …) which take
precedence over the generic mapping.

If a device is missing from the homematic node's list, open an issue with
the device type, ideally with its `getParamsetDescription` output — the
role can then be added without the hardware.

## mDNS (Bonjour)

HomeKit discovers the bridge via mDNS. By default (_auto_) the bridge uses
a running `avahi-daemon` (OpenCCU) over D-Bus and otherwise its built-in
responder (official CCU firmware, RedMatic). The bridge node lets you force
`ciao`, `bonjour-hap` or `avahi` if a network needs it.

## Upgrading from 3.x

- **Pairings survive**: the bridge keeps its identity and accessories keep
  their rooms, scenes and automations. HomeKit data stays in
  `<userDir>/homekit`.
- **Camera and Zigbee nodes are gone** (see the changelog). Flows using
  them still import; the nodes show up as unknown types and must be
  deleted. Use Homebridge (homebridge-camera-ffmpeg) or Scrypted for
  cameras and zigbee2mqtt with the universal node for Zigbee.
- Node.js ≥ 22.12 and Node-RED ≥ 4 are required.

## Documentation and help

- Wiki (German): https://github.com/rdmtc/RedMatic/wiki/Homekit
- Questions and bugs: https://github.com/rdmtc/RedMatic-HomeKit/issues
- Contributing: `npm ci && npm test` — ESLint/Prettier and the
  `node --test` suite also run in CI. Notes for contributors and coding
  agents are in [AGENTS.md](AGENTS.md).

## License

© 2018–2026 Sebastian Raff and RedMatic-HomeKit contributors, licensed
under the [Apache License 2.0](LICENSE).
