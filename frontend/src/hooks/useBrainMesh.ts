import { useCallback, useEffect, useState } from "react";
import type { BrainMesh, BrainRegions } from "../types";

export type MeshType = "normal" | "inflated";

const MESH_FILES: Record<MeshType, string> = {
  normal: "/brain-mesh.json",
  inflated: "/brain-mesh-inflated.json",
};

export function useBrainMesh() {
  const [meshType, setMeshType] = useState<MeshType>("normal");
  const [mesh, setMesh] = useState<BrainMesh | null>(null);
  const [regions, setRegions] = useState<BrainRegions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(MESH_FILES[meshType]).then((r) => r.json()),
      fetch("/brain-regions.json").then((r) => r.json()),
    ]).then(([meshData, regionData]: [BrainMesh, BrainRegions]) => {
      setMesh(meshData);
      setRegions(regionData);
      setLoading(false);
    });
  }, [meshType]);

  const toggleMeshType = useCallback((type: MeshType) => {
    setMeshType(type);
  }, []);

  return { mesh, regions, loading, meshType, toggleMeshType };
}
