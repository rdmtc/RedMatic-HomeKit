# Handoff — redmatic-homekit 4.0.0 (2026-09-02, end of day)

State of the 4.0.0 modernization so work can continue on another machine.
Written by Claude Fable on behalf of hobbyquaker. Read `ROADMAP.md` first
(decisions D-1…D-9, open tasks); completed tasks are in `roadmap-archive/`.

## Where things stand

`master` is at **4.0.0-dev.7**, everything pushed, CI green (lint,
native-dependency scan, `node --test` on Node 22/24 × Node-RED 4/5).
**No tag, no npm release yet.** The npm trusted publisher (OIDC) for
`rdmtc/RedMatic-HomeKit` → `.github/workflows/release.yml` is configured
on npmjs.com (maintainer, 2026-09-02): a tag `v4.0.0-dev.8` would publish
to the `next` dist-tag, a tag `v4.0.0` to `latest`, each with a GitHub
release generated from `CHANGELOG.md`. Only tag when the maintainer says
so.

Done today, in order (details in CHANGELOG.md and the roadmap):

- **dev.0** camera and zigbee nodes removed (D-6/D-7).
- **dev.1** ESLint 9 + Prettier, `node --test`, ci.yml + release.yml,
  `tools/check-native.js` (D-1 gate), AGENTS.md/CLAUDE.md, package metadata.
- **dev.2** `hap-nodejs 0.4.52` → `@homebridge/hap-nodejs ^2.2.3`;
  storage path `<userDir>/homekit` and all UUIDs unchanged (D-4).
- **dev.3** editor device list served by the runtime
  (`homematic-devices/options.json` + `lib/catalogue.js`).
- **dev.4** generic channel mapping (`lib/roles.js`, `lib/generic.js`),
  383 device fixtures, snapshots; bridge mDNS default `auto`.
- **dev.5** golden files for all 190 module types, HmIPW-DRD3
  SingleAccessory option, tv port fix, German README + README.en.md,
  German inline help for all nodes, tasks 5 and 10 archived.
- **dev.6** shared thermostat setpoint/mode logic (`lib/thermostat.js`,
  #245/#225/#335); GitHub triage round 1 (7 PRs, 24 issues closed).
- **dev.7** universal node forwards HomeKit writes again (found on the
  OpenCCU box). OpenCCU hardware test passed (see below).

## Working here

```
git clone git@github.com:rdmtc/RedMatic-HomeKit.git && cd RedMatic-HomeKit
npm ci
npm test               # lint + 31 unit tests + native scan (must be green before every commit)
npm run format         # prettier + eslint --fix
tools/smoke-local.sh   # packs, installs shallowly into a fresh Node-RED 5, publishes a bridge,
                       # browses mDNS (macOS dns-sd), reads/writes HAP in insecure mode
UPDATE_SNAPSHOT=1 node --test test/roles.test.js test/generic.test.js test/modules.test.js
                       # after an intentional mapping change (review the diff first)
```

Versioning: `npm version 4.0.0-dev.N --no-git-tag-version` for every
significant change, commit message `4.0.0-dev.N: …`, push. Commits end
with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` line.
`npm test | grep …` hides the exit code — check `$?` (bit me once).

Test helpers: `test/helpers/harness.js` (fake Node-RED + bridge + device
node + FakeCcu), `test/helpers/fixtures.js` (`fixtures.ccuFor('HmIP-XYZ')`
loads a device type with its VALUES paramset descriptions). Fixtures come
from the MIT-licensed pydevccu catalogue; to regenerate them:
`git clone --depth 1 https://github.com/danielperna84/pydevccu` somewhere
and run `node tools/fixtures-from-pydevccu.js <clone>/pydevccu`.

Reference material that is **not** in the repo (all re-obtainable):
pydevccu (above); the CCU3 firmware image 3.89.8 with the extracted HmIP
device catalogue (`hmip-devicedescription/`, 364 device XMLs) lives in the
node-red-contrib-ccu session scratchpad on the Mac and is described in
`../node-red-contrib-ccu/docs/paramsets.md`; the JP-HB-Devices addon XMLs
are on GitHub (jp112sdl/JP-HB-Devices-addon, `src/addon/firmware/rftypes`).

## Test hosts

- **OpenCCU test box** `172.16.23.119` (OpenCCU 3.89.8 ova, RedMatic
  9.0.0-dev.11, Node 24, Node-RED 5.0.6). WebUI `Admin` / `12345678`,
  ssh `root` / `12345678` (the maintainer's key is installed). Reachable
  from the Mac over WireGuard; **mDNS from the box does not reach the
  Mac** — browse it from a LAN host instead. No Homematic devices are
  paired on it, so the homematic node has nothing to map there.
  - Node-RED admin API on the box: `http://127.0.0.1:1880/addons/red`
    (rega auth): token via
    `POST …/auth/token {"client_id":"node-red-editor","grant_type":"password","scope":"*","username":"Admin","password":"12345678"}`,
    install/upgrade a tarball with `POST …/nodes -F tarball=@file.tgz`
    (bearer token), then `/usr/local/etc/config/rc.d/redmatic restart`.
  - Installed there now: `redmatic-homekit@4.0.0-dev.7` in
    `/usr/local/addons/redmatic/var/node_modules`, plus a flow tab
    "homekit smoke": bridge `CC:22:3D:5A:0B:02`, port 51890, pin
    `031-45-154`, **insecure mode on**, universal Lightbulb → switch,
    pseudobutton. From the Mac:
    `curl -H "Authorization: 031-45-154" http://172.16.23.119:51890/accessories`
    and `PUT …/characteristics` with `{"characteristics":[{"aid":2,"iid":10,"value":true}]}`
    (aid 2 lamp, 3 switch, 4 button; iid 10 = On).
  - Logs: `grep -a homekit /var/log/messages`.
  - Verified 2026-09-02: no avahi-daemon on this build (only
    avahi-autoipd + libs); `auto` correctly picks ciao.
- **LAN helper** `mqtt-ifaces` (ssh alias, 172.16.23.226, Debian, node
  24): `/tmp/mdns/browse.js` (multicast-dns) lists `_hap._tcp` services;
  recreate with `npm install multicast-dns` if /tmp was cleaned. The
  maintainer's **production** RedMatic 3.x bridge shows up there as
  "RedMatic Bridge-969A" — that is the real candidate for the "upgrade
  from a paired 3.3.0" test, but it is production: ask first.

## Next steps (ROADMAP order)

1. **Task 13, remaining hardware**: a real CCU3 with Homematic devices
   (the generic mapping, the thermostat fix and the unreach behaviour have
   only fixture coverage), pairing from an iPhone, the upgrade from a
   paired 3.3.0 (pairings, rooms, automations must survive — D-4), an
   OpenCCU build that runs avahi-daemon if one exists.
2. **Task 9 leftovers**: garage door model (#130 — single-impulse doors
   that auto-close, reversal edge case; hardware-bound), universal node
   colour preset and characteristic props in the editor (#104, #221).
3. **Task 11**: move the German inline help to `locales/` with an
   English fallback; wiki page `Homekit` in rdmtc/RedMatic.wiki.
4. **Task 12, round 2 after the release**: 118 open issues remain —
   device requests (close with a pointer to the snapshot entry once the
   type is verified), behaviour bugs, support questions.
5. **Task 7, optional step 4**: replace individual modules by the generic
   path where `modules.snapshot.json` proves identical output; service
   subtypes differ (modules: running counter, generic: channel index), so
   most modules stay.
6. **Release**: when the maintainer gives the go — bump to the final
   version, update CHANGELOG (German release notes with an English
   summary), `git tag v4.0.0 && git push --tags`; release.yml does the
   rest. A `v4.0.0-dev.N` tag publishes a testable prerelease to `next`
   (`npm install redmatic-homekit@next`).

## Gotchas

- `Accessory.addService()` in `lib/accessory.js` appends a running counter
  to the subtype; the generic layer overrides it with channel-index
  subtypes. Existing modules must keep the counter scheme (D-4).
- `SingleAccessory` defaults to **on** for multi-channel devices (as in
  3.3.0: an option is "enabled unless disabled"); virtual channels and
  buttons on actuators are opt-in (`enabled: true`).
- BidCos devices report `LOWBAT` on mains actuators too; the generic
  battery service is added on BidCos only when the device has no actuator
  role, on HmIP whenever `LOW_BAT` exists.
- hap-nodejs 2.x change events carry `reason` (`write`/`update`/…), not
  the old request context — that is how nodes distinguish HomeKit writes
  from their own updates.
- Insecure HAP access (`allowInsecureRequest`) needs the pin as
  `Authorization` header for writes; reads work without.
- `HAPStorage.setCustomStoragePath` is process-wide and can only be set
  once; `nodes/lib/hap.js` guards it. Tests share one storage path.
- Fixture file names are looked up case-insensitively (pydevccu spells
  some types in upper case; Linux CI is case-sensitive).
