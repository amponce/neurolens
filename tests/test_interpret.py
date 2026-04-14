import numpy as np
import pytest

from backend.interpret import (
    METRIC_CATEGORIES,
    compute_business_scores,
    normalize_scores_over_timeline,
)


def test_metric_categories_has_all_six():
    expected = {
        "visual_attention",
        "audio_engagement",
        "emotional_response",
        "memorability",
        "language_processing",
        "cognitive_load",
    }
    assert set(METRIC_CATEGORIES.keys()) == expected


def test_compute_business_scores_returns_all_metrics():
    roi_values = np.random.rand(180)
    region_names = [f"region_{i}" for i in range(180)]
    scores = compute_business_scores(roi_values, region_names)
    assert set(scores.keys()) == set(METRIC_CATEGORIES.keys())
    for v in scores.values():
        assert isinstance(v, float)


def test_compute_business_scores_higher_visual_with_visual_activation():
    region_names = ["V1", "V2", "V3", "A1", "OFC", "PCC", "44", "8C"]
    roi_values = np.array([0.9, 0.85, 0.8, 0.1, 0.1, 0.1, 0.1, 0.1])
    scores = compute_business_scores(roi_values, region_names)
    assert scores["visual_attention"] > scores["audio_engagement"]
    assert scores["visual_attention"] > scores["emotional_response"]


def test_normalize_scores_over_timeline():
    timeline = [
        {"visual_attention": 0.2, "audio_engagement": 0.5},
        {"visual_attention": 0.8, "audio_engagement": 1.0},
        {"visual_attention": 0.5, "audio_engagement": 0.75},
    ]
    normalized = normalize_scores_over_timeline(timeline)
    va_values = [frame["visual_attention"] for frame in normalized]
    assert max(va_values) == pytest.approx(1.0)
    assert min(va_values) == pytest.approx(0.0)
