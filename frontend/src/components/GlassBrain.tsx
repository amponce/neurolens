import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useBrainMesh, type MeshType } from "../hooks/useBrainMesh";
import { RegionTooltip } from "./RegionTooltip";
import { NeuralPathways } from "./NeuralPathways";
import type { FrameScores, BrainMesh, BrainRegions } from "../types";

interface GlassBrainProps {
  activations: number[] | null;
  frame?: FrameScores | null;
}

interface HoveredRegion {
  name: string;
  fullName?: string;
  category: string;
  value: number;
}

/** Organic brain activation palette:
 *  Inactive = warm ivory (brain tissue), then blush → coral → warm red → orange → amber-white */
function activationToColor(value: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, value));

  // Below activation threshold: warm ivory — brain tissue at rest
  if (v < 0.3) {
    return [0.82, 0.78, 0.74];
  }

  // Remap 0.3–1.0 → 0–1 for heat ramp
  const t = (v - 0.3) / 0.7;

  if (t < 0.25) {
    // Ivory → soft blush pink
    const s = t / 0.25;
    return [
      0.82 + s * 0.1,   // 0.82 → 0.92
      0.78 - s * 0.28,  // 0.78 → 0.50
      0.74 - s * 0.34,  // 0.74 → 0.40
    ];
  } else if (t < 0.5) {
    // Blush → warm coral
    const s = (t - 0.25) / 0.25;
    return [
      0.92 + s * 0.08,  // 0.92 → 1.0
      0.50 - s * 0.18,  // 0.50 → 0.32
      0.40 - s * 0.18,  // 0.40 → 0.22
    ];
  } else if (t < 0.75) {
    // Coral → hot orange
    const s = (t - 0.5) / 0.25;
    return [
      1.0,
      0.32 + s * 0.28,  // 0.32 → 0.60
      0.22 - s * 0.10,  // 0.22 → 0.12
    ];
  } else {
    // Hot orange → radiant amber-white
    const s = (t - 0.75) / 0.25;
    return [
      1.0,
      0.60 + s * 0.35,  // 0.60 → 0.95
      0.12 + s * 0.58,  // 0.12 → 0.70
    ];
  }
}

/** Open mode: rotate each hemisphere 90° around its own center to show lateral surface, then spread */
const HEMISPHERE_SPREAD = 75;
const HEMISPHERE_ROTATE_Y = Math.PI * 0.5; // 90°

interface BrainSurfaceProps {
  mesh: BrainMesh;
  regions: BrainRegions;
  activations: number[] | null;
  hemisphereOpen: boolean;
  onHover: (region: HoveredRegion | null) => void;
}

function BrainSurface({ mesh, regions, activations, hemisphereOpen, onHover }: BrainSurfaceProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { invalidate } = useThree();

  // Store original positions for hemisphere open/close
  const originalPositions = useMemo(() => new Float32Array(mesh.positions), [mesh]);
  const originalNormals = useMemo(() => new Float32Array(mesh.normals), [mesh]);

  const leftCount = mesh.leftCount ?? Math.floor(mesh.vertexCount / 2);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    const positions = new Float32Array(mesh.positions);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const normals = new Float32Array(mesh.normals);
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

    const indices = new Uint32Array(mesh.faces);
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    const colors = new Float32Array(mesh.vertexCount * 3);
    for (let i = 0; i < mesh.vertexCount; i++) {
      colors[i * 3] = 0.82;
      colors[i * 3 + 1] = 0.78;
      colors[i * 3 + 2] = 0.74;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return geo;
  }, [mesh]);

  // Compute hemisphere centroids for pivot points
  const hemiCentroids = useMemo(() => {
    let lx = 0, ly = 0, lz = 0;
    for (let i = 0; i < leftCount; i++) {
      lx += originalPositions[i * 3];
      ly += originalPositions[i * 3 + 1];
      lz += originalPositions[i * 3 + 2];
    }
    lx /= leftCount; ly /= leftCount; lz /= leftCount;

    let rx = 0, ry = 0, rz = 0;
    const rightCount = mesh.vertexCount - leftCount;
    for (let i = leftCount; i < mesh.vertexCount; i++) {
      rx += originalPositions[i * 3];
      ry += originalPositions[i * 3 + 1];
      rz += originalPositions[i * 3 + 2];
    }
    rx /= rightCount; ry /= rightCount; rz /= rightCount;

    return { left: [lx, ly, lz], right: [rx, ry, rz] };
  }, [originalPositions, leftCount, mesh.vertexCount]);

  // Apply hemisphere open/close: rotate 90° around each hemisphere's centroid, then spread
  useEffect(() => {
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const normAttr = geometry.getAttribute("normal") as THREE.BufferAttribute;
    const vertexCount = mesh.vertexCount;

    if (hemisphereOpen) {
      for (let i = 0; i < vertexCount; i++) {
        const ox = originalPositions[i * 3];
        const oy = originalPositions[i * 3 + 1];
        const oz = originalPositions[i * 3 + 2];
        const nx = originalNormals[i * 3];
        const ny = originalNormals[i * 3 + 1];
        const nz = originalNormals[i * 3 + 2];

        const isLeft = i < leftCount;
        const center = isLeft ? hemiCentroids.left : hemiCentroids.right;
        const spread = isLeft ? -HEMISPHERE_SPREAD : HEMISPHERE_SPREAD;

        // Relative to hemisphere centroid
        const dx = ox - center[0];
        const dy = oy - center[1];
        const dz = oz - center[2];

        // Compound rotation: 90° around Y (show lateral surface) + 90° around Z (lay horizontal)
        // Left:  (dx,dy,dz) → (-dy, dz, -dx) — anterior points left, lateral faces camera
        // Right: (dx,dy,dz) → ( dy, dz,  dx) — anterior points right, lateral faces camera
        if (isLeft) {
          posAttr.setXYZ(i, center[0] + (-dy) + spread, center[1] + dz, center[2] + (-dx));
          normAttr.setXYZ(i, -ny, nz, -nx);
        } else {
          posAttr.setXYZ(i, center[0] + dy + spread, center[1] + dz, center[2] + dx);
          normAttr.setXYZ(i, ny, nz, nx);
        }
      }
    } else {
      for (let i = 0; i < vertexCount; i++) {
        posAttr.setXYZ(i, originalPositions[i * 3], originalPositions[i * 3 + 1], originalPositions[i * 3 + 2]);
        normAttr.setXYZ(i, originalNormals[i * 3], originalNormals[i * 3 + 1], originalNormals[i * 3 + 2]);
      }
    }

    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
    geometry.computeBoundingSphere();
    invalidate();
  }, [hemisphereOpen, geometry, originalPositions, originalNormals, leftCount, mesh.vertexCount, hemiCentroids, invalidate]);

  // Only update colors when activations data actually changes -- not every frame
  useEffect(() => {
    if (!activations || activations.length === 0) return;

    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;
    const vertexCount = mesh.vertexCount;
    const activationCount = activations.length;

    for (let i = 0; i < vertexCount; i++) {
      const activationIndex = Math.floor(
        i / (vertexCount / activationCount)
      );
      const value = activations[Math.min(activationIndex, activationCount - 1)];
      const [r, g, b] = activationToColor(value);
      colorAttr.setXYZ(i, r, g, b);
    }

    colorAttr.needsUpdate = true;
    invalidate();
  }, [activations, geometry, mesh.vertexCount, invalidate]);

  function handlePointerMove(event: THREE.Intersection & { face?: THREE.Face | null }) {
    const face = (event as { face?: THREE.Face | null }).face;
    if (!face) {
      onHover(null);
      return;
    }

    const vertexIndex = face.a;
    const regionId = mesh.regionIds[vertexIndex];

    if (regionId === undefined || regionId === -1) {
      onHover(null);
      return;
    }

    const regionKey = String(regionId);
    const regionInfo = regions.regions[regionKey];

    if (!regionInfo) {
      onHover(null);
      return;
    }

    const activationCount = activations ? activations.length : 0;
    const vertexCount = mesh.vertexCount;
    let activationValue = 0;

    if (activations && activationCount > 0) {
      const activationIndex = Math.floor(
        vertexIndex / (vertexCount / activationCount)
      );
      activationValue = activations[Math.min(activationIndex, activationCount - 1)];
    }

    onHover({
      name: regionInfo.name,
      fullName: regionInfo.fullName,
      category: regionInfo.category,
      value: activationValue,
    });
  }

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerMove={(e) => {
        e.stopPropagation();
        handlePointerMove(e as unknown as THREE.Intersection & { face?: THREE.Face | null });
      }}
      onPointerLeave={() => onHover(null)}
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.55}
        metalness={0.02}
        side={THREE.DoubleSide}
        envMapIntensity={0.3}
      />
    </mesh>
  );
}

/* ── Brain View Controls ── */

const controlGroupStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 14,
  left: 14,
  zIndex: 10,
  display: "flex",
  gap: 5,
  alignItems: "center",
  background: "rgba(8, 14, 28, 0.75)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderRadius: 10,
  padding: "6px 10px",
  border: "1px solid rgba(255,255,255,0.06)",
};

const controlLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "0.5625rem",
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(148, 163, 184, 0.6)",
  marginRight: 2,
};

function controlBtnStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--font-body)",
    fontSize: "0.6875rem",
    fontWeight: 500,
    letterSpacing: "0.02em",
    padding: "3px 10px",
    borderRadius: 6,
    border: "1px solid transparent",
    background: active
      ? "rgba(255, 255, 255, 0.1)"
      : "transparent",
    color: active ? "#e2e8f0" : "rgba(148, 163, 184, 0.6)",
    cursor: "pointer",
    transition: "all 0.2s ease",
  };
}

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  background: "rgba(255, 255, 255, 0.08)",
  margin: "0 4px",
};

interface BrainViewControlsProps {
  meshType: MeshType;
  onMeshTypeChange: (type: MeshType) => void;
  hemisphereOpen: boolean;
  onHemisphereToggle: (open: boolean) => void;
}

function BrainViewControls({
  meshType,
  onMeshTypeChange,
  hemisphereOpen,
  onHemisphereToggle,
}: BrainViewControlsProps) {
  return (
    <div style={controlGroupStyle}>
      {/* Surface toggle */}
      <span style={controlLabelStyle}>Surface</span>
      <button
        style={controlBtnStyle(meshType === "normal")}
        onClick={() => onMeshTypeChange("normal")}
      >
        Normal
      </button>
      <button
        style={controlBtnStyle(meshType === "inflated")}
        onClick={() => onMeshTypeChange("inflated")}
      >
        Inflated
      </button>

      <div style={dividerStyle} />

      {/* Hemisphere toggle */}
      <span style={controlLabelStyle}>Hemispheres</span>
      <button
        style={controlBtnStyle(!hemisphereOpen)}
        onClick={() => onHemisphereToggle(false)}
      >
        Close
      </button>
      <button
        style={controlBtnStyle(hemisphereOpen)}
        onClick={() => onHemisphereToggle(true)}
      >
        Open
      </button>
    </div>
  );
}

export function GlassBrain({ activations, frame }: GlassBrainProps) {
  const { mesh, regions, loading, meshType, toggleMeshType } = useBrainMesh();
  const [hoveredRegion, setHoveredRegion] = useState<HoveredRegion | null>(null);
  const [hemisphereOpen, setHemisphereOpen] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHover = useCallback((region: HoveredRegion | null) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (region) {
      setHoveredRegion(region);
    } else {
      hoverTimeoutRef.current = setTimeout(() => setHoveredRegion(null), 80);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 0, 250], fov: 45 }}
        gl={{ antialias: true }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        frameloop="always"
      >
        <ambientLight intensity={0.4} color="#e8e0d8" />
        <directionalLight position={[100, 120, 80]} intensity={1.2} color="#fff5ee" />
        <directionalLight position={[-80, -40, -60]} intensity={0.35} color="#c8d8e8" />
        <directionalLight position={[0, -80, 120]} intensity={0.25} color="#e0e8f0" />
        <directionalLight position={[-60, 100, -40]} intensity={0.15} color="#d0d8ff" />

        <OrbitControls
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={0.7}
          minDistance={150}
          maxDistance={400}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI - 0.1}
          enablePan={false}
        />

        {!loading && mesh && regions && (
          <BrainSurface
            mesh={mesh}
            regions={regions}
            activations={activations}
            hemisphereOpen={hemisphereOpen}
            onHover={handleHover}
          />
        )}
        {regions && <NeuralPathways regions={regions} frame={frame ?? null} />}
      </Canvas>

      {/* Brain view controls — bottom-left overlay */}
      <BrainViewControls
        meshType={meshType}
        onMeshTypeChange={toggleMeshType}
        hemisphereOpen={hemisphereOpen}
        onHemisphereToggle={setHemisphereOpen}
      />

      {hoveredRegion && (
        <RegionTooltip
          name={hoveredRegion.name}
          fullName={hoveredRegion.fullName}
          category={hoveredRegion.category}
          value={hoveredRegion.value}
        />
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-500 text-sm">Loading brain mesh...</p>
        </div>
      )}
    </div>
  );
}
