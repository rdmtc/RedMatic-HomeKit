# RedMatic HomeKit

[![NPM version](https://badge.fury.io/js/redmatic-homekit.svg)](http://badge.fury.io/js/redmatic-homekit)
[![CI](https://github.com/rdmtc/RedMatic-HomeKit/actions/workflows/ci.yml/badge.svg)](https://github.com/rdmtc/RedMatic-HomeKit/actions/workflows/ci.yml)

> Node-RED-Nodes, die Homematic-Geräte und beliebige Node-RED-Daten als
> HomeKit-Zubehör bereitstellen (HAP-NodeJS). Für RedMatic auf der CCU3 /
> OpenCCU, funktioniert aber in jeder Node-RED-Installation.

_[English version](README.en.md)_

> **Version 4.0.0** (September 2026) ist die erste Version für RedMatic 9.
> Was sich gegenüber 3.3.0 ändert, steht im [Changelog](CHANGELOG.md);
> bestehende Kopplungen bleiben beim Update erhalten.

## Was es kann

- **Homematic-Geräte automatisch in HomeKit** – über einen
  [node-red-contrib-ccu](https://github.com/rdmtc/node-red-contrib-ccu)-
  ccu-connection Node werden Schalter, Dimmer, Farblichter, Rollläden und
  Jalousien, Thermostate, Tür-/Fensterkontakte, Griffkontakte,
  Bewegungs- und Präsenzmelder, Rauch-, Wasser- und Regenmelder,
  Temperatur-/Feuchte-/Helligkeitssensoren, CO₂-Sensoren, Taster und
  Fernbedienungen (als programmierbare Schalter), Türschlossantriebe
  (HmIP-DLD, KeyMatic), Garagentormodule und Batteriestände als
  HomeKit-Zubehör angelegt. Pro Gerät und Kanal lässt sich im Editor
  einstellen, ob und als was (Steckdose, Lampe, Lüfter, Ventil, Tür,
  Fenster, …) ein Kanal erscheint.
- **Universal-Node** für beliebiges HomeKit-Zubehör (jeder HAP-Service, jede
  Charakteristik) aus Node-RED-Nachrichten – für Systemvariablen, MQTT,
  Zigbee2MQTT, Hue und alles andere, was in Node-RED ankommt.
- **Switch**, **Pseudobutton** (Schalter, der sich selbst zurücksetzt und
  eine Nachricht auslöst), **Stateless Programmable Switch** (Taster-Events
  aus Nachrichten), **Garage** und **Bewässerung** auf Basis von
  Homematic-Aktoren und -Kontakten, **TV** (eigenständiges
  Fernseher-Zubehör mit Fernbedienung im Kontrollzentrum).

## Installation

**RedMatic 9 (CCU3 / OpenCCU):** Im Node-RED-Editor unter _Palette
verwalten → Installieren_ nach `redmatic-homekit` suchen und installieren.
Es werden keine nativen Module und keine Binärprogramme benötigt.

**Andere Node-RED-Installationen:** `npm install redmatic-homekit` im
Node-RED-Benutzerverzeichnis (`~/.node-red`). Voraussetzungen: Node.js
≥ 22.12, Node-RED ≥ 4.

Einrichtung in Kürze:

1. Einen **homekit bridge**-Konfigurationsknoten anlegen (MAC-Adresse und
   PIN werden vorgeschlagen). Nach dem Deploy zeigt der Knoten den
   QR-Code zum Koppeln mit der Home-App.
2. Den **homematic**-Node mit der CCU-Verbindung und der Bridge
   verbinden, im Node die gewünschten Geräte und Kanäle auswählen,
   deployen.
3. In der Home-App _Gerät hinzufügen_ → QR-Code scannen (oder den
   Einrichtungscode eingeben).

Eine Bridge fasst bis zu 149 Zubehörteile; für mehr Geräte legt man einen
zweiten Bridge-Knoten (andere MAC-Adresse, anderer Port) an.

## Geräteunterstützung

Seit 4.0.0 werden Geräte nicht mehr nur über eine feste Liste erkannt.
Für jeden Kanal ermittelt der Node aus der Gerätebeschreibung der CCU
(den `CONTROL`-Hinweisen, dem Kanaltyp und den Datenpunktnamen) die
Rolle und daraus den passenden HomeKit-Service. Damit funktionieren auch
Geräte, die es beim Erscheinen dieser Version noch nicht gab, sowie
Homebrew-Geräte (HB-\*) und CUxD-Geräte, deren Kanäle einer bekannten
Rolle entsprechen. Für rund 190 Gerätetypen gibt es weiterhin speziell
abgestimmte Module (Thermostat-Logik, Rollladen mit Lamellen, LEDs des
HmIP-BSL, Sirenen, …), die Vorrang vor der generischen Zuordnung haben.

Fehlt ein Gerät in der Liste des homematic-Nodes, bitte ein Issue mit dem
Gerätetyp öffnen – am besten mit einem Auszug der Gerätebeschreibung
(`getParamsetDescription`), dann lässt sich die Rolle ohne das Gerät
nachrüsten.

## mDNS (Bonjour)

HomeKit findet die Bridge per mDNS. Standardmäßig (_auto_) benutzt die
Bridge einen laufenden `avahi-daemon` (OpenCCU) über D-Bus und sonst den
eingebauten Responder (offizielle CCU-Firmware, RedMatic). Im
Bridge-Knoten lässt sich das auf `ciao`, `bonjour-hap` oder `avahi`
festlegen, falls ein Netzwerk Probleme macht.

## Umstieg von 3.x

- **Kopplungen bleiben erhalten**: Die Bridge behält ihre Identität, die
  Zubehörteile ihre Zuordnung zu Räumen, Szenen und Automationen. Die
  HomeKit-Daten liegen weiterhin in `<userDir>/homekit`.
- **Kamera- und Zigbee-Nodes entfallen** (siehe Changelog). Flows mit
  diesen Nodes lassen sich weiter importieren; die Nodes erscheinen als
  unbekannter Typ und müssen gelöscht werden. Für Kameras eignen sich
  Homebridge (homebridge-camera-ffmpeg) oder Scrypted, für Zigbee
  zigbee2mqtt zusammen mit dem Universal-Node.
- Node.js ≥ 22.12 und Node-RED ≥ 4 werden vorausgesetzt.

## Dokumentation und Hilfe

- Wiki (deutsch): https://github.com/rdmtc/RedMatic/wiki/Homekit
- Fragen und Fehler: https://github.com/rdmtc/RedMatic-HomeKit/issues
- Mitmachen: `npm ci && npm test` – ESLint/Prettier und die Tests
  (`node --test`) laufen auch in der CI. Hinweise für Beitragende und
  KI-Agenten stehen in [AGENTS.md](AGENTS.md).

## Lizenz

© 2018–2026 Sebastian Raff und RedMatic-HomeKit-Contributors,
lizenziert unter der [Apache License 2.0](LICENSE).
