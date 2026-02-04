# NATO APP-6 Symbology & Icon Handling

This document describes how **cmop_map** resolves icons for map entities using **NATO APP-6** symbology, including category mapping, fallback logic, country variants, and medical role representation. The orignal documentation is on the mirror folder of the [https://github.com/MartinezAgullo/mapa-puntos-interes/tree/main/public/icons](mapa-puntos-interes) project.

---

## What is NATO APP-6?

**APP-6 (Allied Procedural Publication No. 6)** is the NATO standard for military symbology. It defines a common visual language to represent units, equipment, installations, and activities across all operational domains.

In **cmop_map**, APP-6-style symbols are provided as simplified SVGs optimized for web mapping while preserving doctrinal meaning.

---

## Icon Generation

All icons used by this project were generated with the following tool:

👉 [https://spatialillusions.com/unitgenerator/](https://spatialillusions.com/unitgenerator/)

This tool was used to produce standardized APP-6–compatible symbols suitable for consistent rendering in web environments.

---

## Icon Resolution Logic

Each map entity defines:

* `categoria` (enum)
* `alliance` (`friendly`, `hostile`, `neutral`, `unknown`)
* `country` (optional, e.g. Spain, France, Germany, NATO, UN)

Icons are organized as follows:

```bash
public/icons/
    ├── friendly/
    ├── hostile/
    ├── neutral/
    └── unknown/
```

Country-specific variants may exist:

```bash
infantry_spain.svg
infantry_france.svg
tank_usa.svg
base_portugal.svg
```

---

## Resolution Algorithm

Given:

```bash
category = 'tank'
alliance = 'friendly'
country  = 'Spain'
```

### 1. Category → base icon names

Each category maps to one or more base identifiers:

```bash
infantry    → ['infantry', 'ground']
tank        → ['tank', 'armor_mechanized', 'ground']
aircraft    → ['fixed_wing', 'air_and_space']
helicopter  → ['helicopter', 'rotary_wing']
submarine   → ['submarine', 'sub_surface']
```

### 2. Candidate filenames (per base)

1. `base_country.svg`
2. `base.svg`
3. `default.svg` (final fallback)

### 3. Resolution

Files are checked in order using a lightweight `HEAD` request:

```bash
/icons/{alliance}/{filename}
```

The first existing file is selected.

---

## Examples

### Friendly Infantry (Spain)

```bash
infantry_spain.svg
infantry.svg
ground.svg
default.svg
```

### Hostile Tank (Unknown country)

```bash
tank.svg
armor_mechanized.svg
default.svg
```

### Neutral Naval Unit (China)

```bash
ship_china.svg
ship.svg
sea_surface.svg
default.svg
```

---

## Medical Units and Roles

Medical units in **cmop_map** follow NATO doctrinal roles as defined in APP-6 symbology. These roles describe the level of medical capability provided, not merely the unit size.

### Medical Unit – Role 1 Capability

* Immediate lifesaving measures and first aid
* Triage, basic resuscitation, and stabilization
* Typically organic to combat units
* No surgical capability

### Medical Unit – Role 2 Capability

* Enhanced medical treatment beyond Role 1
* Limited hospitalization and damage-control surgery
* Improved diagnostic capability
* Usually brigade-level or equivalent

### Medical Unit – Role 3 Capability

* Full hospital-level care within the theater
* Advanced surgery, specialist treatment, and inpatient care
* Supports sustained operations
* Acts as a major medical treatment facility

### Medical Unit – Role 4 Capability

* Definitive medical care outside the operational theater
* Strategic-level hospitals, often in the home nation
* Long-term treatment, rehabilitation, and recovery

These roles are encoded visually in accordance with NATO APP-6 conventions and should be interpreted as capability indicators, not command relationships.

---

## Design Rationale

This layered resolution system provides:

* Maximum use of detailed APP-6 symbols when available
* Country-specific differentiation without hard dependencies
* Graceful degradation with incomplete icon sets
* Straightforward extensibility for new categories or nations

To extend the system, simply add new SVGs under the appropriate alliance directory; no code changes are required.
