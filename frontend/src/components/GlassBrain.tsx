import { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useBrainMesh } from "../hooks/useBrainMesh";
import { RegionTooltip } from "./RegionTooltip";
import type { FrameScores, BrainMesh, BrainRegions } from "../types";

interface GlassBrainProps {
  activations: number[] | null;
  frame?: FrameScores | null;
}

interface HoveredRegion {
  name: string;
  category: string;
  value: number;
}

function activationToColor(value: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, value));

  if (v < 0.25) {
    const t = v / 0.25;
    return [0.1, 0.1, 0.3 + t * 0.2];
  } else if (v < 0.5) {
    const t = (v - 0.25) / 0.25;
    return [0.1, 0.1 + t * 0.7, 0.5 + t * 0.5];
  } else if (v < 0.75) {
    const t = (v - 0.5) / 0.25;
    return [0.1 + t * 0.9, 0.8 - t * 0.0, 1.0 - t * 0.8];
  } else {
    const t = (v - 0.75) / 0.25;
    return [1.0, 0.8 - t * 0.6, 0.2 - t * 0.1];
  }
}

interface BrainSurfaceProps {
  mesh: BrainMesh;
  regions: BrainRegions;
  activations: number[] | null;
  onHover: (region: HoveredRegion | null) => void;
}

function BrainSurface({ mesh, regions, activations, onHover }: BrainSurfaceProps) {
  const meshRef = useRef<THREE.Mesh>(null);

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
      colors[i * 3] = 0.1;
      colors[i * 3 + 1] = 0.1;
      colors[i * 3 + 2] = 0.3;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return geo;
  }, [mesh]);

  useFrame(() => {
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
  });

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
      <meshPhysicalMaterial
        vertexColors
        transparent
        opacity={0.6}
        roughness={0.15}
        metalness={0.1}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
        transmission={0.3}
        thickness={2.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function GlassBrain({ activations, frame: _frame }: GlassBrainProps) {
  const { mesh, regions, loading } = useBrainMesh();
  const [hoveredRegion, setHoveredRegion] = useState<HoveredRegion | null>(null);

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 0, 250], fov: 45 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[100, 100, 100]} intensity={0.8} />
        <directionalLight position={[-100, -50, -100]} intensity={0.3} />
        <pointLight position={[0, 200, 0]} intensity={0.5} color="#4fc3f7" />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          minDistance={150}
          maxDistance={400}
        />

        {!loading && mesh && regions && (
          <BrainSurface
            mesh={mesh}
            regions={regions}
            activations={activations}
            onHover={setHoveredRegion}
          />
        )}
      </Canvas>

      {hoveredRegion && (
        <RegionTooltip
          name={hoveredRegion.name}
          category={hoveredRegion.category}
          value={hoveredRegion.value}
        />
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-500 text-sm">Loading brain mesh…</p>
        </div>
      )}
    </div>
  );
}
