#!/usr/bin/env python3
"""
convert_data.py
Converts several Milan open-data CSV files into a single JavaScript datasets file
for use in the real estate dashboard.

Data sources:
  - ds503  : Aree edifici degradati/abbandonati (Comune di Milano)
  - ds616  : Aste di vendita immobili pubblici (Comune di Milano)
  - ds147  : Beni immobili confiscati (Comune di Milano)
  - ds1448 : Cascine Milano (Comune di Milano)
  - ds2940 : Quotazioni OMI compravendita 2024 semestre 2 (Agenzia delle Entrate)
  - CENED_5: Certificazione energetica degli edifici - Lombardia subset
"""

import csv
import json
import math
import os
import sys
from pathlib import Path

DATA_DIR = Path("/home/user/test/data")
OUTPUT_FILE = Path("/home/user/test/js/datasets.js")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def read_csv(filename, separator=";"):
    """Read a CSV with automatic encoding detection (utf-8 then latin-1)."""
    filepath = DATA_DIR / filename
    for encoding in ("utf-8", "latin-1"):
        try:
            with open(filepath, encoding=encoding, newline="") as fh:
                reader = csv.DictReader(fh, delimiter=separator)
                rows = list(reader)
            print(f"  Read {len(rows):,} rows from '{filename}' (encoding={encoding})")
            return rows
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"Cannot decode {filepath}")


def to_float(value, default=None):
    """Convert an Italian-formatted number string (comma decimal) to float."""
    if value is None:
        return default
    v = str(value).strip().replace(",", ".").replace("\xa0", "").replace(" ", "")
    if v == "" or v == "-" or v.lower() in ("nan", "n/d", "nd"):
        return default
    try:
        result = float(v)
        if math.isnan(result) or math.isinf(result):
            return default
        return result
    except ValueError:
        return default


def to_int(value, default=None):
    f = to_float(value)
    if f is None:
        return default
    return int(f)


def safe_str(value):
    """Strip and return string, None if empty."""
    if value is None:
        return None
    v = str(value).strip()
    return v if v else None


def js_value(v):
    """Render a Python value as a JavaScript literal."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        if math.isnan(v) or math.isinf(v):
            return "null"
        # Use integer representation when value is a whole number
        if isinstance(v, float) and v == int(v):
            return str(int(v))
        return json.dumps(v)
    # string - escape for single-quoted JS string
    s = str(v).replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
    return f"'{s}'"


def render_js_any(v, indent=0):
    """Recursively render a Python value as a JS literal."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        if math.isnan(v) or math.isinf(v):
            return "null"
        if isinstance(v, float) and v == int(v):
            return str(int(v))
        return json.dumps(v)
    if isinstance(v, dict):
        return render_js_object(v, indent)
    if isinstance(v, list):
        return render_js_array(v, indent)
    s = str(v).replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
    return f"'{s}'"


def render_js_object(d, indent=0):
    pad = "  " * indent
    inner_pad = "  " * (indent + 1)
    lines = ["{"]
    items = list(d.items())
    for i, (k, v) in enumerate(items):
        comma = "," if i < len(items) - 1 else ""
        lines.append(f"{inner_pad}{k}: {render_js_any(v, indent + 1)}{comma}")
    lines.append(pad + "}")
    return "\n".join(lines)


def render_js_array(lst, indent=0):
    pad = "  " * indent
    inner_pad = "  " * (indent + 1)
    if not lst:
        return "[]"
    lines = ["["]
    for i, item in enumerate(lst):
        comma = "," if i < len(lst) - 1 else ""
        lines.append(f"{inner_pad}{render_js_any(item, indent + 1)}{comma}")
    lines.append(pad + "]")
    return "\n".join(lines)


def records_to_js_array(records, varname):
    """Render list-of-dicts as a compact one-line-per-record JS const array."""
    lines = [f"const {varname} = ["]
    for i, rec in enumerate(records):
        comma = "," if i < len(records) - 1 else ""
        inner_parts = []
        for k, v in rec.items():
            inner_parts.append(f"{k}: {render_js_any(v)}")
        inner = ", ".join(inner_parts)
        lines.append(f"  {{ {inner} }}{comma}")
    lines.append("];")
    return "\n".join(lines)


def cened_stats_to_js(stats):
    lines = ["const CENED_STATS = {"]
    lines.append(f"  byClasse: {render_js_array(stats['byClasse'], indent=1)},")
    lines.append(f"  byDestinazione: {render_js_array(stats['byDestinazione'], indent=1)},")
    lines.append(f"  totale: {stats['totale']},")
    lines.append(f"  avgEmissioni: {render_js_any(stats['avgEmissioni'])}")
    lines.append("};")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# DS503 - Edifici degradati/abbandonati
# ---------------------------------------------------------------------------

def convert_ds503():
    print("Processing ds503 - Edifici degradati/abbandonati ...")
    rows = read_csv("ds503_aree_edifici_degradati_abbandonati_0_final (1).csv", separator=";")
    results = []
    skipped = 0
    for r in rows:
        lat = to_float(r.get("LAT_Y_4326"))
        lng = to_float(r.get("LONG_X_4326"))
        if lat is None or lng is None:
            skipped += 1
            continue
        obj = {
            "id":        to_int(r.get("OBJECTID")),
            "codice":    safe_str(r.get("COD_PROG")),
            "indirizzo": safe_str(r.get("INDIRIZZO")),
            "tipoMacro": safe_str(r.get("TIPO_MACRO")),
            "municipio": to_int(r.get("MUNICIPIO")),
            "nil":       safe_str(r.get("NIL")),
            "lat":       lat,
            "lng":       lng,
        }
        results.append(obj)
    print(f"  -> {len(results)} records (skipped {skipped} missing lat/lng)")
    return results


# ---------------------------------------------------------------------------
# DS616 - Aste di vendita immobili pubblici
# ---------------------------------------------------------------------------

def convert_ds616():
    print("Processing ds616 - Aste immobili pubblici ...")
    rows = read_csv(
        "ds616_aste-di-vendita-immobili-pubblici-nel-comune-di-mi_uizd-wnps_final.csv",
        separator=";"
    )
    results = []
    skipped = 0
    for r in rows:
        lat = to_float(r.get("GEO_Y"))
        lng = to_float(r.get("GEO_X"))
        if lat is None or lng is None:
            skipped += 1
            continue
        base_asta_raw = safe_str(r.get("BASE_ASTA"))
        base_asta = to_float(base_asta_raw) if base_asta_raw else None
        obj = {
            "id":               safe_str(r.get("IDENTIFICATIVO")),
            "ente":             safe_str(r.get("ENTE")),
            "lotto":            safe_str(r.get("NOME_LOTTO")),
            "stato":            safe_str(r.get("STATO")),
            "baseAsta":         base_asta,
            "annoCostruzione":  safe_str(r.get("ANNO_COSTRUZIONE")),
            "indirizzo":        safe_str(r.get("INDIRIZZO")),
            "mq":               safe_str(r.get("METRI_QUADRATI")),
            "destinazione":     safe_str(r.get("DESTINAZIONE")),
            "locali":           safe_str(r.get("N_LOCALI")),
            "piano":            safe_str(r.get("PIANO")),
            "classeEnergetica": safe_str(r.get("CLASSE_ENERGETICA")),
            "note":             safe_str(r.get("NOTE")),
            "municipio":        to_int(r.get("MUNICIPIO")),
            "nil":              safe_str(r.get("NIL")),
            "lat":              lat,
            "lng":              lng,
        }
        results.append(obj)
    print(f"  -> {len(results)} records (skipped {skipped} missing lat/lng)")
    return results


# ---------------------------------------------------------------------------
# DS147 - Beni immobili confiscati
# ---------------------------------------------------------------------------

def convert_ds147():
    print("Processing ds147 - Beni immobili confiscati ...")
    rows = read_csv("ds147_elenco-beni-immobili-confiscati-03_2026.csv", separator=";")
    results = []
    for idx, r in enumerate(rows, start=1):
        # "Unita' immobiliare" is the primary key; handle encoding variants
        uid_raw = None
        for key in r.keys():
            if "unit" in key.lower() and "immobiliare" in key.lower():
                uid_raw = safe_str(r[key])
                break
        obj = {
            "id":            to_int(uid_raw) if uid_raw and uid_raw.isdigit() else idx,
            "tipologia":     safe_str(r.get("Tipologia")),
            "consistenza":   safe_str(r.get("Consistenza")),
            "indirizzo":     safe_str(r.get("Indirizzo")),
            "municipio":     to_int(r.get("Municipio")),
            "destinazione":  safe_str(r.get("Tipologia destinazione")),
            "utilizzazione": safe_str(r.get("Utilizzazione")),
            "ente":          safe_str(r.get("Ente assegnatario")),
        }
        results.append(obj)
    print(f"  -> {len(results)} records")
    return results


# ---------------------------------------------------------------------------
# DS1448 - Cascine Milano
# ---------------------------------------------------------------------------

def convert_ds1448():
    print("Processing ds1448 - Cascine Milano ...")
    rows = read_csv("ds1448_cascine_milano_031023.csv", separator=";")
    results = []
    skipped = 0
    for idx, r in enumerate(rows, start=1):
        lat = to_float(r.get("LAT_Y_4326"))
        lng = to_float(r.get("LONG_X_4326"))
        if lat is None or lng is None:
            skipped += 1
            continue
        # Handle encoding variants for "localita"
        localita = None
        for key in r.keys():
            if "localit" in key.lower():
                localita = safe_str(r[key])
                break
        obj = {
            "id":        idx,
            "nome":      safe_str(r.get("cascina")),
            "via":       safe_str(r.get("via")),
            "localita":  localita,
            "municipio": to_int(r.get("MUNICIPIO")),
            "nil":       safe_str(r.get("NIL")),
            "lat":       lat,
            "lng":       lng,
        }
        results.append(obj)
    print(f"  -> {len(results)} records (skipped {skipped} missing lat/lng)")
    return results


# ---------------------------------------------------------------------------
# DS2940 - Quotazioni OMI compravendita
# ---------------------------------------------------------------------------

def convert_ds2940():
    print("Processing ds2940 - Quotazioni OMI compravendita 2024/2 ...")
    rows = read_csv("ds2940_quotazioni_omi_compravendita_2024_2.csv", separator=";")
    results = []
    for r in rows:
        obj = {
            "fascia":    safe_str(r.get("Fascia")),
            "zona":      safe_str(r.get("Zona")),
            "codTip":    safe_str(r.get("Cod_Tip")),
            "tipologia": safe_str(r.get("Descr_Tipologia")),
            "stato":     safe_str(r.get("Stato")),
            "comprMin":  to_float(r.get("Compr_min")),
            "comprMax":  to_float(r.get("Compr_max")),
            "supNL":     safe_str(r.get("Sup_NL_compr")),
        }
        results.append(obj)
    print(f"  -> {len(results)} records")
    return results


# ---------------------------------------------------------------------------
# CENED_5 - Certificazione energetica (filtered to MILANO)
# ---------------------------------------------------------------------------

def convert_cened():
    print("Processing CENED_5 - Certificazione energetica (Milano only) ...")
    rows = read_csv("CENED_5.csv", separator=",")

    milano_rows = [r for r in rows if str(r.get("COMUNE", "")).strip().upper() == "MILANO"]
    totale = len(milano_rows)
    print(f"  Milano rows: {totale:,} / {len(rows):,} total")

    # --- byClasse ---
    classe_data = {}
    for r in milano_rows:
        cls = safe_str(r.get("CLASSE_ENERGETICA")) or "N/D"
        em = to_float(r.get("EMISSIONI_DI_CO2"))
        if cls not in classe_data:
            classe_data[cls] = {"count": 0, "emissions_sum": 0.0, "emissions_n": 0}
        classe_data[cls]["count"] += 1
        if em is not None:
            classe_data[cls]["emissions_sum"] += em
            classe_data[cls]["emissions_n"] += 1

    # Canonical energy class sort order (best to worst)
    CLASS_ORDER = ["A4", "A3", "A2", "A1", "A+", "A", "B", "C", "D", "E", "F", "G", "N/D"]

    def class_sort_key(cls):
        try:
            return CLASS_ORDER.index(cls)
        except ValueError:
            return len(CLASS_ORDER)

    by_classe = []
    for cls in sorted(classe_data.keys(), key=class_sort_key):
        d = classe_data[cls]
        avg_em = round(d["emissions_sum"] / d["emissions_n"], 2) if d["emissions_n"] > 0 else None
        by_classe.append({
            "classe":       cls,
            "count":        d["count"],
            "avgEmissioni": avg_em,
        })

    # --- byDestinazione ---
    dest_data = {}
    for r in milano_rows:
        dest = safe_str(r.get("DESTINAZIONE_DI_USO")) or "N/D"
        dest_data[dest] = dest_data.get(dest, 0) + 1

    by_destinazione = [
        {"destinazione": k, "count": v}
        for k, v in sorted(dest_data.items(), key=lambda x: -x[1])
    ]

    # --- overall avg emissions ---
    valid_emissions = [
        to_float(r.get("EMISSIONI_DI_CO2"))
        for r in milano_rows
        if to_float(r.get("EMISSIONI_DI_CO2")) is not None
    ]
    avg_emissioni = round(sum(valid_emissions) / len(valid_emissions), 2) if valid_emissions else None

    print(f"  -> byClasse: {len(by_classe)} classes | byDestinazione: {len(by_destinazione)} types")

    return {
        "byClasse":       by_classe,
        "byDestinazione": by_destinazione,
        "totale":         totale,
        "avgEmissioni":   avg_emissioni,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("Milan Real Estate Dashboard - Data Conversion")
    print("=" * 60)

    errors = []

    def safe_convert(fn, name):
        try:
            return fn()
        except Exception as e:
            print(f"ERROR in {name}: {e}")
            errors.append((name, str(e)))
            return []

    edifici    = safe_convert(convert_ds503,  "ds503")
    aste       = safe_convert(convert_ds616,  "ds616")
    confiscati = safe_convert(convert_ds147,  "ds147")
    cascine    = safe_convert(convert_ds1448, "ds1448")
    quotazioni = safe_convert(convert_ds2940, "ds2940")

    try:
        cened_stats = convert_cened()
    except Exception as e:
        print(f"ERROR in CENED_5: {e}")
        errors.append(("CENED_5", str(e)))
        cened_stats = {"byClasse": [], "byDestinazione": [], "totale": 0, "avgEmissioni": None}

    print("\nWriting output ...")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    header = """\
// =============================================================================
// datasets.js - Auto-generated by convert_data.py
// Milan Real Estate Dashboard - JavaScript Data Files
//
// Sources:
//   EDIFICI_DEGRADATI  : ds503  - Aree edifici degradati/abbandonati (Comune di Milano)
//   ASTE_PUBBLICHE     : ds616  - Aste di vendita immobili pubblici   (Comune di Milano)
//   BENI_CONFISCATI    : ds147  - Beni immobili confiscati            (Comune di Milano)
//   CASCINE_MILANO     : ds1448 - Cascine Milano                      (Comune di Milano)
//   QUOTAZIONI_OMI     : ds2940 - Quotazioni OMI compravendita 2024/2 (Agenzia Entrate)
//   CENED_STATS        : CENED_5 - Certificazione energetica edifici  (Regione Lombardia)
// =============================================================================

"""

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        fh.write(header)

        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write("// Edifici Degradati / Abbandonati\n")
        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write(records_to_js_array(edifici, "EDIFICI_DEGRADATI"))
        fh.write("\n\n")

        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write("// Aste Pubbliche Immobili\n")
        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write(records_to_js_array(aste, "ASTE_PUBBLICHE"))
        fh.write("\n\n")

        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write("// Beni Immobili Confiscati\n")
        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write(records_to_js_array(confiscati, "BENI_CONFISCATI"))
        fh.write("\n\n")

        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write("// Cascine Milano\n")
        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write(records_to_js_array(cascine, "CASCINE_MILANO"))
        fh.write("\n\n")

        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write("// Quotazioni OMI Compravendita 2024/2\n")
        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write(records_to_js_array(quotazioni, "QUOTAZIONI_OMI"))
        fh.write("\n\n")

        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write("// CENED - Statistiche Certificazione Energetica (Milano)\n")
        fh.write("// ---------------------------------------------------------------------------\n")
        fh.write(cened_stats_to_js(cened_stats))
        fh.write("\n")

    size_kb = OUTPUT_FILE.stat().st_size / 1024
    print(f"\nOutput written to: {OUTPUT_FILE}")
    print(f"File size: {size_kb:.1f} KB")
    print("\nSummary:")
    print(f"  EDIFICI_DEGRADATI : {len(edifici):>6} records")
    print(f"  ASTE_PUBBLICHE    : {len(aste):>6} records")
    print(f"  BENI_CONFISCATI   : {len(confiscati):>6} records")
    print(f"  CASCINE_MILANO    : {len(cascine):>6} records")
    print(f"  QUOTAZIONI_OMI    : {len(quotazioni):>6} records")
    print(f"  CENED_STATS       : {cened_stats['totale']:>6} Milano buildings aggregated")

    if errors:
        print(f"\nErrors encountered ({len(errors)}):")
        for name, msg in errors:
            print(f"  {name}: {msg}")
        sys.exit(1)
    else:
        print("\nAll datasets converted successfully.")


if __name__ == "__main__":
    main()
