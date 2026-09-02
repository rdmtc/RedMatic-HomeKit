#!/bin/bash
# Local smoke test (ROADMAP task 3/13): packs this checkout, installs it the
# way RedMatic 9's palette manager does (shallow, no lockfile) into a fresh
# Node-RED user directory, deploys a bridge with universal/switch/pseudobutton
# nodes, browses mDNS (macOS dns-sd) and reads the accessory list over HAP in
# insecure mode. Needs network access for the npm installs.
#
#   tools/smoke-local.sh            # Node-RED 5 (default)
#   NODE_RED=4 tools/smoke-local.sh # Node-RED 4
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=${WORK:-$(mktemp -d -t redmatic-homekit-smoke)}
PORT=${PORT:-1890}
HAP_PORT=${HAP_PORT:-51890}
NODE_RED=${NODE_RED:-5}
PIN=031-45-154

echo "work dir: $WORK"
TGZ=$(cd "$ROOT" && npm pack --pack-destination "$WORK" 2>/dev/null | tail -1)
mkdir -p "$WORK/userDir" && cd "$WORK/userDir"
npm init -y >/dev/null
npm install --install-strategy=shallow --no-package-lock --no-audit --no-fund "node-red@$NODE_RED" "$WORK/$TGZ" 2>&1 | tail -1
echo "nested deps of redmatic-homekit: $(ls node_modules/redmatic-homekit/node_modules | wc -l | tr -d ' ')"

cat > "$WORK/flows.json" <<EOF
[
 {"id":"bridge1","type":"redmatic-homekit-bridge","name":"Smoke Bridge","username":"CC:22:3D:5A:0B:01","pincode":"$PIN","port":"$HAP_PORT","advertiser":"auto","allowInsecureRequest":true},
 {"id":"tab1","type":"tab","label":"smoke"},
 {"id":"uni1","type":"redmatic-homekit-universal","z":"tab1","name":"Smoke Lamp","bridgeConfig":"bridge1","services":[{"service":"Lightbulb","subtype":"0","name":"Smoke Lamp"}],"x":300,"y":100,"wires":[["sw1"]]},
 {"id":"btn1","type":"redmatic-homekit-pseudobutton","z":"tab1","name":"Smoke Button","bridgeConfig":"bridge1","topic":"smoke","payload":"","payloadType":"date","x":300,"y":160,"wires":[[]]},
 {"id":"sw1","type":"redmatic-homekit-switch","z":"tab1","name":"Smoke Switch","bridgeConfig":"bridge1","x":600,"y":100,"wires":[[]]}
]
EOF

node node_modules/node-red/red.js --userDir "$WORK/userDir" --port "$PORT" > "$WORK/node-red.log" 2>&1 &
NR=$!
trap 'kill $NR 2>/dev/null; wait $NR 2>/dev/null' EXIT
for i in $(seq 1 60); do curl -s -o /dev/null "localhost:$PORT/flows" && break; sleep 1; done
echo "node-red $NODE_RED up after ${i}s"
curl -s -X POST -H "Content-Type: application/json" -H "Node-RED-Deployment-Type: full" --data @"$WORK/flows.json" "localhost:$PORT/flows" >/dev/null
for i in $(seq 1 30); do grep -q "published bridge" "$WORK/node-red.log" && break; sleep 1; done
grep "published bridge" "$WORK/node-red.log" || { echo "bridge did not publish"; tail -20 "$WORK/node-red.log"; exit 1; }

echo "--- setup URI"; curl -s "localhost:$PORT/redmatic-homekit?config=bridge1"; echo
echo "--- storage"; ls "$WORK/userDir/homekit"
if command -v dns-sd >/dev/null; then
    echo "--- dns-sd (5s)"
    dns-sd -B _hap._tcp local. > "$WORK/dnssd.log" 2>&1 & DS=$!
    sleep 5; kill $DS 2>/dev/null
    grep "Smoke Bridge" "$WORK/dnssd.log" || echo "bridge NOT seen via mDNS"
fi
H="http://127.0.0.1:$HAP_PORT"; A="Authorization: $PIN"
echo "--- HAP accessories (insecure mode)"
curl -s -m 10 -H "$A" "$H/accessories" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);for(const a of j.accessories)for(const sv of a.services){const n=(sv.characteristics.find(c=>c.type==="23")||{}).value;if(n)console.log("aid",a.aid,n)}})'
echo "--- HAP write loop: lamp on -> switch follows"
ids() { curl -s -m 10 -H "$A" "$H/accessories" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);for(const a of j.accessories)for(const sv of a.services){const n=(sv.characteristics.find(c=>c.type==="23")||{}).value;const on=sv.characteristics.find(c=>c.type==="25");if(n===process.argv[1]&&on)console.log(a.aid+"."+on.iid)}})' "$1"; }
LAMP=$(ids "Smoke Lamp"); SWITCH=$(ids "Smoke Switch")
curl -s -m 10 -X PUT "$H/characteristics" -H "$A" -H "Content-Type: application/hap+json" -d "{\"characteristics\":[{\"aid\":${LAMP%.*},\"iid\":${LAMP#*.},\"value\":true}]}" -o /dev/null -w "put lamp on: %{http_code}\n"
sleep 1; RESULT=$(curl -s -m 10 -H "$A" "$H/characteristics?id=$LAMP,$SWITCH"); echo "$RESULT"
echo "$RESULT" | grep -q "\"aid\":${SWITCH%.*},\"iid\":${SWITCH#*.},\"value\":1" && echo "switch followed the lamp: OK" || { echo "switch did NOT follow"; exit 1; }
echo "--- errors/warnings in the log"; grep -i "error\|warn" "$WORK/node-red.log" | grep -v "Encrypted credentials\|Projects disabled" || echo "(none)"
echo "done — work dir kept at $WORK"
