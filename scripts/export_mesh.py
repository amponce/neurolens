"""
Export fsaverage5 brain mesh and HCP atlas region data to JSON files
for the React frontend.

Output files:
  frontend/public/brain-mesh.json
  frontend/public/brain-mesh-inflated.json
  frontend/public/brain-regions.json
"""

import json
import os
import sys
import warnings

import numpy as np

# Suppress noisy warnings from nilearn / mne / neuralset
warnings.filterwarnings("ignore")
os.environ.setdefault("PYTHONWARNINGS", "ignore")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(REPO_ROOT, "frontend", "public")

# ---------------------------------------------------------------------------
# Business-category mapping (region name → category key)
# ---------------------------------------------------------------------------
CATEGORY_REGIONS: dict[str, list[str]] = {
    "visual_attention": [
        "V1", "V2", "V3", "V4", "V3A", "V3B", "V6", "V6A", "V7", "V8",
        "MT", "MST", "FST", "FFC", "VVC", "VMV1", "VMV2", "VMV3", "PIT",
    ],
    "audio_engagement": [
        "A1", "LBelt", "MBelt", "PBelt", "RI", "A4", "A5", "STGa", "TA2",
    ],
    "emotional_response": [
        "OFC", "10v", "10r", "a24", "p32", "s32", "25", "pOFC",
        "13l", "10d", "Ig",
    ],
    "memorability": [
        "PCC", "RSC", "POS1", "POS2", "PreS", "H", "EC",
        "PeEc", "PHA1", "PHA2", "PHA3",
    ],
    "language_processing": [
        "44", "45", "47l", "TPOJ1", "TPOJ2", "TPOJ3", "STV",
        "PSL", "SFL", "STSdp", "STSda", "STSvp", "STSva",
    ],
    "cognitive_load": [
        "8C", "46", "p9-46v", "8Av", "8Ad", "FEF", "IPS1",
        "8BL", "9m", "9p", "i6-8", "s6-8",
    ],
}

# Build reverse lookup: region_name → category_key
REGION_TO_CATEGORY: dict[str, str] = {}
for cat_key, names in CATEGORY_REGIONS.items():
    for name in names:
        REGION_TO_CATEGORY[name] = cat_key

# ---------------------------------------------------------------------------
# HCP MMP1.0 full descriptive names
# Source: Glasser et al. 2016, "A multi-modal parcellation of human cerebral cortex"
# ---------------------------------------------------------------------------
HCP_FULL_NAMES: dict[str, str] = {
    "V1": "Primary Visual Cortex",
    "V2": "Secondary Visual Cortex",
    "V3": "Third Visual Area",
    "V4": "Fourth Visual Area",
    "V3A": "Visual Area V3A",
    "V3B": "Visual Area V3B",
    "V3CD": "Dorsal V3 Complex",
    "V6": "Sixth Visual Area",
    "V6A": "Visual Area V6A",
    "V7": "Seventh Visual Area",
    "V8": "Eighth Visual Area (VO1)",
    "MT": "Middle Temporal Visual Area (V5)",
    "MST": "Medial Superior Temporal Area",
    "FST": "Fundus of Superior Temporal Sulcus",
    "FFC": "Fusiform Face Complex",
    "VVC": "Ventral Visual Complex",
    "VMV1": "Ventromedial Visual Area 1",
    "VMV2": "Ventromedial Visual Area 2",
    "VMV3": "Ventromedial Visual Area 3",
    "PIT": "Posterior Inferotemporal Area",
    "PH": "Parahippocampal Area",
    "LO1": "Lateral Occipital Area 1",
    "LO2": "Lateral Occipital Area 2",
    "LO3": "Lateral Occipital Area 3",
    "V1": "Primary Visual Cortex",
    "A1": "Primary Auditory Cortex",
    "LBelt": "Lateral Belt of Auditory Cortex",
    "MBelt": "Medial Belt of Auditory Cortex",
    "PBelt": "Parabelt of Auditory Cortex",
    "RI": "Retroinsular Cortex",
    "A4": "Auditory Association Area 4",
    "A5": "Auditory Association Area 5",
    "STGa": "Anterior Superior Temporal Gyrus",
    "TA2": "Temporal Area 2 (Auditory)",
    "OFC": "Orbitofrontal Cortex",
    "10v": "Anterior Prefrontal Cortex (Ventral)",
    "10r": "Anterior Prefrontal Cortex (Rostral)",
    "10d": "Anterior Prefrontal Cortex (Dorsal)",
    "10pp": "Polar Prefrontal Cortex",
    "a24": "Anterior Cingulate Area 24",
    "p32": "Posterior Cingulate Area 32",
    "s32": "Subgenual Cingulate Area 32",
    "25": "Subgenual Cingulate Cortex (Area 25)",
    "pOFC": "Posterior Orbitofrontal Cortex",
    "13l": "Orbitofrontal Area 13l",
    "Ig": "Insular Granular Cortex",
    "PCC": "Posterior Cingulate Cortex",
    "RSC": "Retrosplenial Cortex",
    "POS1": "Parieto-Occipital Sulcus Area 1",
    "POS2": "Parieto-Occipital Sulcus Area 2",
    "PreS": "Presubiculum",
    "H": "Hippocampus",
    "EC": "Entorhinal Cortex",
    "PeEc": "Perirhinal Ectorhinal Cortex",
    "PHA1": "Parahippocampal Area 1",
    "PHA2": "Parahippocampal Area 2",
    "PHA3": "Parahippocampal Area 3",
    "44": "Broca's Area (Pars Opercularis)",
    "45": "Broca's Area (Pars Triangularis)",
    "47l": "Inferior Frontal Area 47l",
    "47m": "Inferior Frontal Area 47m",
    "47s": "Inferior Frontal Area 47s",
    "TPOJ1": "Temporo-Parieto-Occipital Junction 1",
    "TPOJ2": "Temporo-Parieto-Occipital Junction 2",
    "TPOJ3": "Temporo-Parieto-Occipital Junction 3",
    "STV": "Superior Temporal Visual Area",
    "PSL": "Perisylvian Language Area",
    "SFL": "Superior Frontal Language Area",
    "STSdp": "Superior Temporal Sulcus (Dorsal Posterior)",
    "STSda": "Superior Temporal Sulcus (Dorsal Anterior)",
    "STSvp": "Superior Temporal Sulcus (Ventral Posterior)",
    "STSva": "Superior Temporal Sulcus (Ventral Anterior)",
    "8C": "Frontal Eye Field Complex (Area 8C)",
    "46": "Dorsolateral Prefrontal Cortex (Area 46)",
    "p9-46v": "Prefrontal Area p9-46v",
    "8Av": "Frontal Area 8Av",
    "8Ad": "Frontal Area 8Ad",
    "FEF": "Frontal Eye Fields",
    "IPS1": "Intraparietal Sulcus Area 1",
    "8BL": "Frontal Area 8BL",
    "9m": "Medial Prefrontal Area 9",
    "9p": "Posterior Prefrontal Area 9",
    "i6-8": "Inferior Frontal Area 6-8",
    "s6-8": "Superior Frontal Area 6-8",
    "1": "Primary Somatosensory Cortex (Area 1)",
    "2": "Somatosensory Area 2",
    "3a": "Somatosensory Area 3a",
    "3b": "Somatosensory Area 3b",
    "4": "Primary Motor Cortex (Area 4)",
    "5L": "Superior Parietal Area 5L",
    "5m": "Medial Superior Parietal Area 5m",
    "5mv": "Medial Ventral Parietal Area 5mv",
    "6a": "Premotor Area 6a",
    "6d": "Dorsal Premotor Area 6d",
    "6ma": "Supplementary Motor Area 6ma",
    "6mp": "Pre-Supplementary Motor Area 6mp",
    "6r": "Rostral Premotor Area 6r",
    "6v": "Ventral Premotor Area 6v",
    "7AL": "Superior Parietal Area 7AL",
    "7Am": "Medial Superior Parietal Area 7Am",
    "7PC": "Postcentral Area 7PC",
    "7PL": "Lateral Superior Parietal Area 7PL",
    "7Pm": "Medial Superior Parietal Area 7Pm",
    "8BM": "Medial Frontal Area 8BM",
    "9a": "Prefrontal Area 9a",
    "11l": "Orbitofrontal Area 11l",
    "23c": "Posterior Cingulate Area 23c",
    "23d": "Dorsal Posterior Cingulate Area 23d",
    "24dd": "Dorsal Anterior Cingulate Area 24dd",
    "24dv": "Ventral Dorsal Cingulate Area 24dv",
    "31a": "Cingulate Area 31a",
    "31pd": "Posterior Dorsal Cingulate Area 31pd",
    "31pv": "Posterior Ventral Cingulate Area 31pv",
    "33pr": "Pregenual Cingulate Area 33",
    "43": "Subcentral Area (Gustatory Cortex)",
    "52": "Parainsular Area 52",
    "55b": "Premotor Area 55b",
    "a9-46v": "Anterior Prefrontal Area a9-46v",
    "a10p": "Anterior Polar Area 10p",
    "a24pr": "Anterior Cingulate Area 24pr",
    "a32pr": "Anterior Cingulate Area 32pr",
    "a47r": "Anterior Inferior Frontal Area 47r",
    "AIP": "Anterior Intraparietal Area",
    "AVI": "Anterior Ventral Insular Area",
    "d23ab": "Dorsal Area 23a/b",
    "d32": "Dorsal Cingulate Area 32",
    "DVT": "Dorsal Transitional Visual Area",
    "FOP1": "Frontal Opercular Area 1",
    "FOP2": "Frontal Opercular Area 2",
    "FOP3": "Frontal Opercular Area 3",
    "FOP4": "Frontal Opercular Area 4",
    "FOP5": "Frontal Opercular Area 5",
    "IP0": "Intraparietal Area 0",
    "IP1": "Intraparietal Area 1",
    "IP2": "Intraparietal Area 2",
    "IFJa": "Inferior Frontal Junction Area (Anterior)",
    "IFJp": "Inferior Frontal Junction Area (Posterior)",
    "IFSa": "Inferior Frontal Sulcus (Anterior)",
    "IFSp": "Inferior Frontal Sulcus (Posterior)",
    "Ins": "Insular Cortex",
    "LIPd": "Lateral Intraparietal (Dorsal)",
    "LIPv": "Lateral Intraparietal (Ventral)",
    "MIP": "Medial Intraparietal Area",
    "MI": "Middle Insular Area",
    "OP1": "Parietal Opercular Area 1",
    "OP2-3": "Parietal Opercular Area 2-3",
    "OP4": "Parietal Opercular Area 4",
    "OPi": "Inferior Parietal Opercular Area",
    "p10p": "Posterior Polar Area 10p",
    "p24": "Posterior Area 24",
    "p24pr": "Posterior Cingulate Area 24pr",
    "p32pr": "Posterior Area 32pr",
    "p47r": "Posterior Inferior Frontal Area 47r",
    "PCV": "Precuneus Visual Area",
    "PEF": "Premotor Eye Field",
    "PF": "Inferior Parietal Area PF",
    "PFcm": "Inferior Parietal Area PFcm",
    "PFm": "Inferior Parietal Area PFm",
    "PFop": "Inferior Parietal Area PFop",
    "PFt": "Inferior Parietal Area PFt",
    "PGi": "Inferior Parietal Area PGi",
    "PGs": "Superior Parietal Area PGs",
    "PGp": "Posterior Parietal Area PGp",
    "PHT": "Parahippocampal Transition Area",
    "PI": "Para-Insular Area",
    "Pir": "Piriform Cortex",
    "PoI1": "Posterior Insular Area 1",
    "PoI2": "Posterior Insular Area 2",
    "ProS": "Prostriate Area",
    "RSC": "Retrosplenial Complex",
    "SCEF": "Supplementary and Cingulate Eye Field",
    "STV": "Superior Temporal Visual Area",
    "STSdp": "Superior Temporal Sulcus (Dorsal Posterior)",
    "STSda": "Superior Temporal Sulcus (Dorsal Anterior)",
    "STSvp": "Superior Temporal Sulcus (Ventral Posterior)",
    "STSva": "Superior Temporal Sulcus (Ventral Anterior)",
    "TF": "Temporal Fusiform Area TF",
    "TE1a": "Temporal Area TE1a",
    "TE1m": "Temporal Area TE1m",
    "TE1p": "Temporal Area TE1p",
    "TE2a": "Temporal Area TE2a",
    "TE2p": "Temporal Area TE2p",
    "TGd": "Temporal Polar (Dorsal)",
    "TGv": "Temporal Polar (Ventral)",
    "V3A": "Visual Area V3A",
    "V3B": "Visual Area V3B",
    "V6": "Sixth Visual Area",
    "V6A": "Visual Area V6A",
    "ProS": "Prostriate Area",
    "DVT": "Dorsal Transitional Visual Area",
    "PCV": "Precuneus Visual Area",
    "IPS1": "Intraparietal Sulcus Area 1",
    "MIP": "Medial Intraparietal Area",
    "LIPd": "Lateral Intraparietal (Dorsal)",
    "LIPv": "Lateral Intraparietal (Ventral)",
    "AIP": "Anterior Intraparietal Area",
    "VIP": "Ventral Intraparietal Area",
    "Pol1": "Polar Area 1",
    "Pol2": "Polar Area 2",
    "TE2p": "Temporal Area TE2p",
    "STPSa": "Superior Temporal Polysensory (Anterior)",
    "STPs": "Superior Temporal Polysensory Area",
    "PreS": "Presubiculum",
    "Pir": "Piriform Cortex",
    "AAIC": "Anterior Agranular Insular Complex",
    "7m": "Medial Area 7m (Precuneus)",
    "9-46d": "Dorsal Prefrontal Area 9-46d",
    "?": "Unknown / Unassigned Region",
    "V4t": "Visual Area V4 (Transitional)",
    "v23ab": "Ventral Area 23a/b",
}

CATEGORY_LABELS: dict[str, str] = {
    "visual_attention": "Visual Attention",
    "audio_engagement": "Audio Engagement",
    "emotional_response": "Emotional Response",
    "memorability": "Memorability",
    "language_processing": "Language Processing",
    "cognitive_load": "Cognitive Load",
    "other": "Other",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def compute_vertex_normals(positions: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """
    Compute per-vertex normals by averaging face normals (weighted by area).

    Parameters
    ----------
    positions : (N, 3) float array
    faces     : (F, 3) int array

    Returns
    -------
    normals : (N, 3) float array (unit length)
    """
    v0 = positions[faces[:, 0]]
    v1 = positions[faces[:, 1]]
    v2 = positions[faces[:, 2]]

    # Cross-product gives face normal scaled by triangle area
    face_normals = np.cross(v1 - v0, v2 - v0)  # (F, 3)

    # Accumulate into per-vertex normals
    vertex_normals = np.zeros_like(positions)
    for i in range(3):
        np.add.at(vertex_normals, faces[:, i], face_normals)

    # Normalise
    norms = np.linalg.norm(vertex_normals, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)  # avoid divide-by-zero
    return vertex_normals / norms


def compute_region_centroid(positions: np.ndarray, vertex_indices: np.ndarray) -> list[float]:
    """Return the mean position of the given vertices."""
    pts = positions[vertex_indices]
    centroid = pts.mean(axis=0)
    return centroid.tolist()


# ---------------------------------------------------------------------------
# Main export logic
# ---------------------------------------------------------------------------

def main() -> None:
    print("Loading nilearn …")
    import nilearn.datasets
    import nilearn.surface

    # ------------------------------------------------------------------
    # 1. Load fsaverage5 mesh
    # ------------------------------------------------------------------
    print("Fetching fsaverage5 …")
    fsaverage = nilearn.datasets.fetch_surf_fsaverage("fsaverage5")

    # ------------------------------------------------------------------
    # 2. Load hemisphere meshes
    # ------------------------------------------------------------------
    print("Loading left hemisphere …")
    lh_mesh = nilearn.surface.load_surf_mesh(fsaverage["pial_left"])
    lh_coords = np.array(lh_mesh[0])   # (N_L, 3)
    lh_faces  = np.array(lh_mesh[1])   # (F_L, 3)

    print("Loading right hemisphere …")
    rh_mesh = nilearn.surface.load_surf_mesh(fsaverage["pial_right"])
    rh_coords = np.array(rh_mesh[0])   # (N_R, 3)
    rh_faces  = np.array(rh_mesh[1])   # (F_R, 3)

    # ------------------------------------------------------------------
    # 2b. Load inflated hemisphere meshes
    # ------------------------------------------------------------------
    print("Loading inflated left hemisphere …")
    lh_infl = nilearn.surface.load_surf_mesh(fsaverage["infl_left"])
    lh_infl_coords = np.array(lh_infl[0])  # (N_L, 3)

    print("Loading inflated right hemisphere …")
    rh_infl = nilearn.surface.load_surf_mesh(fsaverage["infl_right"])
    rh_infl_coords = np.array(rh_infl[0])  # (N_R, 3)

    n_left = lh_coords.shape[0]

    # ------------------------------------------------------------------
    # 3. Offset right-hemisphere face indices and concatenate
    # ------------------------------------------------------------------
    rh_faces_offset = rh_faces + n_left

    all_positions = np.concatenate([lh_coords, rh_coords], axis=0)  # (N, 3)
    all_faces     = np.concatenate([lh_faces, rh_faces_offset], axis=0)  # (F, 3)

    # Inflated positions (same faces/topology)
    all_infl_positions = np.concatenate(
        [lh_infl_coords, rh_infl_coords], axis=0
    )  # (N, 3)

    n_vertices = all_positions.shape[0]
    n_faces    = all_faces.shape[0]
    print(f"  Vertices: {n_vertices}, Faces: {n_faces}")

    # ------------------------------------------------------------------
    # 5. Compute vertex normals
    # ------------------------------------------------------------------
    print("Computing vertex normals …")
    all_normals = compute_vertex_normals(all_positions, all_faces)

    print("Computing inflated vertex normals …")
    all_infl_normals = compute_vertex_normals(all_infl_positions, all_faces)

    # ------------------------------------------------------------------
    # 6. Per-vertex HCP region labels
    # ------------------------------------------------------------------
    print("Loading HCP vertex labels …")
    import tribev2.utils as trib_utils

    vertex_labels: list[str] = trib_utils.get_hcp_vertex_labels(
        mesh="fsaverage5", combine=False
    )
    assert len(vertex_labels) == n_vertices, (
        f"Vertex label count mismatch: {len(vertex_labels)} != {n_vertices}"
    )

    # ------------------------------------------------------------------
    # 7. Build region_to_id mapping (sorted unique names; "" → 0)
    # ------------------------------------------------------------------
    unique_names = sorted(set(vertex_labels) - {""})
    # ID 0 reserved for unlabeled ("")
    region_to_id: dict[str, int] = {"": 0}
    for idx, name in enumerate(unique_names, start=1):
        region_to_id[name] = idx

    region_ids: list[int] = [region_to_id[lbl] for lbl in vertex_labels]

    # ------------------------------------------------------------------
    # 8. Compute region centroids from hcp_labels
    # ------------------------------------------------------------------
    print("Computing region centroids …")
    hcp_label_map: dict[str, np.ndarray] = trib_utils.get_hcp_labels(
        mesh="fsaverage5", combine=False, hemi="both"
    )

    # ------------------------------------------------------------------
    # 9. Build regions dict for JSON
    # ------------------------------------------------------------------
    regions_out: dict[str, dict] = {}
    for region_name, rid in region_to_id.items():
        if region_name == "":
            continue  # skip unlabeled sentinel
        category = REGION_TO_CATEGORY.get(region_name, "other")

        # Centroid
        if region_name in hcp_label_map:
            vertices_for_region = hcp_label_map[region_name].astype(int)
            # Clamp to valid range (safety guard)
            vertices_for_region = vertices_for_region[vertices_for_region < n_vertices]
            centroid = compute_region_centroid(all_positions, vertices_for_region)
        else:
            # Fall back to mean of all vertices with this label
            idxs = np.where(np.array(vertex_labels) == region_name)[0]
            centroid = compute_region_centroid(all_positions, idxs)

        full_name = HCP_FULL_NAMES.get(region_name, region_name)

        regions_out[str(rid)] = {
            "name": region_name,
            "fullName": full_name,
            "category": category,
            "centroid": [round(v, 4) for v in centroid],
        }

    # ------------------------------------------------------------------
    # 10. Serialise and save
    # ------------------------------------------------------------------
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    # brain-mesh.json
    mesh_path = os.path.join(PUBLIC_DIR, "brain-mesh.json")
    print(f"Writing {mesh_path} …")
    mesh_payload = {
        "positions":   [round(float(v), 4) for v in all_positions.ravel()],
        "normals":     [round(float(v), 6) for v in all_normals.ravel()],
        "faces":       all_faces.ravel().tolist(),
        "regionIds":   region_ids,
        "vertexCount": n_vertices,
        "faceCount":   n_faces,
        "leftCount":   n_left,
    }
    with open(mesh_path, "w") as fh:
        json.dump(mesh_payload, fh, separators=(",", ":"))

    # brain-mesh-inflated.json
    infl_mesh_path = os.path.join(PUBLIC_DIR, "brain-mesh-inflated.json")
    print(f"Writing {infl_mesh_path} …")
    infl_mesh_payload = {
        "positions":   [round(float(v), 4) for v in all_infl_positions.ravel()],
        "normals":     [round(float(v), 6) for v in all_infl_normals.ravel()],
        "faces":       all_faces.ravel().tolist(),
        "regionIds":   region_ids,
        "vertexCount": n_vertices,
        "faceCount":   n_faces,
        "leftCount":   n_left,
    }
    with open(infl_mesh_path, "w") as fh:
        json.dump(infl_mesh_payload, fh, separators=(",", ":"))

    # brain-regions.json
    regions_path = os.path.join(PUBLIC_DIR, "brain-regions.json")
    print(f"Writing {regions_path} …")
    regions_payload = {
        "regions":    regions_out,
        "categories": CATEGORY_LABELS,
    }
    with open(regions_path, "w") as fh:
        json.dump(regions_payload, fh, separators=(",", ":"), indent=2)

    print("Done.")
    print(f"  brain-mesh.json          : {os.path.getsize(mesh_path) / 1e6:.1f} MB")
    print(f"  brain-mesh-inflated.json : {os.path.getsize(infl_mesh_path) / 1e6:.1f} MB")
    print(f"  brain-regions.json       : {os.path.getsize(regions_path) / 1e3:.1f} KB")


if __name__ == "__main__":
    main()
