"""
Interpretation layer that maps TRIBE v2 ROI activations to business-facing
engagement scores.
"""
from __future__ import annotations

import numpy as np

# Maps each business metric category to its human-readable label
METRIC_CATEGORIES: dict[str, str] = {
    "visual_attention": "Visual Attention",
    "audio_engagement": "Audio Engagement",
    "emotional_response": "Emotional Response",
    "memorability": "Memorability",
    "language_processing": "Language Processing",
    "cognitive_load": "Cognitive Load",
}

# Maps ROI region names to their business metric category
ROI_TO_CATEGORY: dict[str, str] = {
    # Visual attention regions
    "V1": "visual_attention",
    "V2": "visual_attention",
    "V3": "visual_attention",
    "V4": "visual_attention",
    "V3A": "visual_attention",
    "V3B": "visual_attention",
    "V6": "visual_attention",
    "V6A": "visual_attention",
    "V7": "visual_attention",
    "V8": "visual_attention",
    "MT": "visual_attention",
    "MST": "visual_attention",
    "FST": "visual_attention",
    "FFC": "visual_attention",
    "VVC": "visual_attention",
    "VMV1": "visual_attention",
    "VMV2": "visual_attention",
    "VMV3": "visual_attention",
    "PIT": "visual_attention",
    # Audio engagement regions
    "A1": "audio_engagement",
    "LBelt": "audio_engagement",
    "MBelt": "audio_engagement",
    "PBelt": "audio_engagement",
    "RI": "audio_engagement",
    "A4": "audio_engagement",
    "A5": "audio_engagement",
    "STGa": "audio_engagement",
    "TA2": "audio_engagement",
    # Emotional response regions
    "OFC": "emotional_response",
    "10v": "emotional_response",
    "10r": "emotional_response",
    "a24": "emotional_response",
    "p32": "emotional_response",
    "s32": "emotional_response",
    "25": "emotional_response",
    "pOFC": "emotional_response",
    "13l": "emotional_response",
    "10d": "emotional_response",
    "Ig": "emotional_response",
    # Memorability regions
    "PCC": "memorability",
    "RSC": "memorability",
    "POS1": "memorability",
    "POS2": "memorability",
    "PreS": "memorability",
    "H": "memorability",
    "EC": "memorability",
    "PeEc": "memorability",
    "PHA1": "memorability",
    "PHA2": "memorability",
    "PHA3": "memorability",
    # Language processing regions
    "44": "language_processing",
    "45": "language_processing",
    "47l": "language_processing",
    "TPOJ1": "language_processing",
    "TPOJ2": "language_processing",
    "TPOJ3": "language_processing",
    "STV": "language_processing",
    "PSL": "language_processing",
    "SFL": "language_processing",
    "STSdp": "language_processing",
    "STSda": "language_processing",
    "STSvp": "language_processing",
    "STSva": "language_processing",
    # Cognitive load regions
    "8C": "cognitive_load",
    "46": "cognitive_load",
    "p9-46v": "cognitive_load",
    "8Av": "cognitive_load",
    "8Ad": "cognitive_load",
    "FEF": "cognitive_load",
    "IPS1": "cognitive_load",
    "8BL": "cognitive_load",
    "9m": "cognitive_load",
    "9p": "cognitive_load",
    "i6-8": "cognitive_load",
    "s6-8": "cognitive_load",
}


def compute_business_scores(
    roi_values: np.ndarray,
    region_names: list[str],
) -> dict[str, float]:
    """
    Group ROI activations by business metric category and return the mean
    activation per group.

    Args:
        roi_values: 1-D array of activation values aligned with region_names.
        region_names: List of ROI region labels corresponding to roi_values.

    Returns:
        Dict mapping each metric category to its mean activation (float).
        Categories with no matching ROIs return 0.0.
    """
    # Accumulate activations per category
    category_values: dict[str, list[float]] = {k: [] for k in METRIC_CATEGORIES}

    for name, value in zip(region_names, roi_values):
        category = ROI_TO_CATEGORY.get(name)
        if category is not None:
            category_values[category].append(float(value))

    # Compute mean per category; default 0.0 for empty groups
    return {
        category: float(np.mean(values)) if values else 0.0
        for category, values in category_values.items()
    }


def normalize_scores_over_timeline(
    timeline: list[dict[str, float]],
) -> list[dict[str, float]]:
    """
    Min-max normalize each metric across all timesteps to [0, 1].

    Args:
        timeline: List of per-frame score dicts, each mapping metric name to value.

    Returns:
        New list of dicts with each metric normalized to [0, 1] across all frames.
        If a metric has zero spread (max == min) the normalized value is 0.0.
        Returns an empty list if timeline is empty.
    """
    if not timeline:
        return []

    # Collect all metric keys from the first frame (consistent across frames)
    metrics = list(timeline[0].keys())

    # Compute per-metric min and max across all frames
    metric_min: dict[str, float] = {}
    metric_max: dict[str, float] = {}
    for metric in metrics:
        values = [frame[metric] for frame in timeline]
        metric_min[metric] = float(min(values))
        metric_max[metric] = float(max(values))

    # Build normalized timeline without mutating input frames
    normalized: list[dict[str, float]] = []
    for frame in timeline:
        new_frame: dict[str, float] = {}
        for metric in metrics:
            spread = metric_max[metric] - metric_min[metric]
            if spread == 0.0:
                new_frame[metric] = 0.0
            else:
                new_frame[metric] = (frame[metric] - metric_min[metric]) / spread
        normalized.append(new_frame)

    return normalized
