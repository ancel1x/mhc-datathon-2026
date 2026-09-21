"""Smoke tests: helpers plus contract checks on the generated bundle (skipped until the pipeline has run)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
import config as C  # noqa: E402
from pipeline.common import is_peak, matched_months, nysp_to_wgs84, pct_change  # noqa: E402

BUNDLE = C.BUNDLE_DIR
needs_bundle = pytest.mark.skipif(not (BUNDLE / "summary.json").exists(), reason="run the pipeline first")


def test_reprojection_lands_in_manhattan():
    lon, lat = nysp_to_wgs84(989913.7965, 200030.9599)   # Williamsburg Bridge approach (DOT segment 252708)
    assert -74.0 < lon < -73.97 and 40.71 < lat < 40.72


def test_pct_change_and_matched_months():
    assert pct_change(100, 110) == 10.0
    assert pct_change(0, 5) is None and pct_change(None, 5) is None
    assert matched_months(["2024-03", "2024-04"], ["2025-04", "2025-05"]) == ["04"]


def test_peak_schedule_matches_toll_hours():
    hours = list(range(24))
    wd = is_peak(hours, [False] * 24)
    we = is_peak(hours, [True] * 24)
    assert wd[4] == False and wd[5] == True and wd[20] == True and wd[21] == False  # noqa: E712
    assert we[8] == False and we[9] == True  # noqa: E712


def _load(name):
    return json.loads((BUNDLE / name).read_text(encoding="utf-8"))


@needs_bundle
def test_summary_headline_numbers_are_sane():
    s = _load("summary.json")
    assert 350_000 < s["crz"]["avg_weekday_entries_2025"] < 700_000
    assert s["bt"]["system_avg_daily_2024"] and 600_000 < s["bt"]["system_avg_daily_2024"] < 1_200_000
    assert s["aq"]["sites_total"] >= 12
    assert s["aq"]["control"]["name"].lower().startswith("van wyck")
    assert s["equity"]["dac_designated_tracts"] > 500


@needs_bundle
def test_point_layers_have_common_props_and_hour_arrays():
    for layer in ("crz_entry_points.geojson", "bt_facilities.geojson", "aq_monitors.geojson"):
        fc = _load(layer)
        assert fc["features"], layer
        for f in fc["features"]:
            p = f["properties"]
            for k in ("id", "name", "layer", "dac_designated", "uhf42_name"):
                assert k in p, (layer, k)
            for stats in p["periods"].values():
                if stats:
                    assert len(stats["hourly_weekday"]) == 24


@needs_bundle
def test_aq_values_in_plausible_range_and_zone_split():
    fc = _load("aq_monitors.geojson")
    statuses = {f["properties"]["crz_status"] for f in fc["features"]}
    assert "inside" in statuses and "outside" in statuses
    for f in fc["features"]:
        for stats in f["properties"]["periods"].values():
            if stats and stats["mean"] is not None:
                assert 1.0 < stats["mean"] < 30.0


@needs_bundle
def test_dot_matched_have_both_sides():
    for m in _load("dot_matched.json"):
        assert m["pre_months"] and m["post_months"]
        assert m["pre_adv"] and m["post_adv"]
