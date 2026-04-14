import { useEffect, useState } from "react";
import type { BrainMesh, BrainRegions } from "../types";

export function useBrainMesh() {
  const [mesh, setMesh] = useState<BrainMesh | null>(null);
  const [regions, setRegions] = useState<BrainRegions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/brain-mesh.json").then((r) => r.json()),
      fetch("/brain-regions.json").then((r) => r.json()),
    ]).then(([meshData, regionData]: [BrainMesh, BrainRegions]) => {
      setMesh(meshData);
      setRegions(regionData);
      setLoading(false);
    });
  }, []);

  return { mesh, regions, loading };
}
