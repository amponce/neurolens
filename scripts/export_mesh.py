"""
Export fsaverage5 brain mesh and HCP atlas region data to JSON files
for the React frontend.

Output files:
  frontend/public/brain-mesh.json
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

    n_left = lh_coords.shape[0]

    # ------------------------------------------------------------------
    # 3. Offset right-hemisphere face indices and concatenate
    # ------------------------------------------------------------------
    rh_faces_offset = rh_faces + n_left

    all_positions = np.concatenate([lh_coords, rh_coords], axis=0)  # (N, 3)
    all_faces     = np.concatenate([lh_faces, rh_faces_offset], axis=0)  # (F, 3)

    n_vertices = all_positions.shape[0]
    n_faces    = all_faces.shape[0]
    print(f"  Vertices: {n_vertices}, Faces: {n_faces}")

    # ------------------------------------------------------------------
    # 5. Compute vertex normals
    # ------------------------------------------------------------------
    print("Computing vertex normals …")
    all_normals = compute_vertex_normals(all_positions, all_faces)

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

        regions_out[str(rid)] = {
            "name": region_name,
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
    }
    with open(mesh_path, "w") as fh:
        json.dump(mesh_payload, fh, separators=(",", ":"))

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
    print(f"  brain-mesh.json    : {os.path.getsize(mesh_path) / 1e6:.1f} MB")
    print(f"  brain-regions.json : {os.path.getsize(regions_path) / 1e3:.1f} KB")


if __name__ == "__main__":
    main()
