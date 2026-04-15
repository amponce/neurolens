import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BrainRegions, FrameScores } from "../types";
import { METRIC_COLORS } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveNode {
  regionKey: string;
  name: string;
  category: string;
  position: THREE.Vector3;
  intensity: number;
}

interface Connection {
  start: THREE.Vector3;
  end: THREE.Vector3;
  category: string;
}

// ---------------------------------------------------------------------------
// GlowingSphere — pulsing sphere rendered at an active brain region
// ---------------------------------------------------------------------------

interface GlowingSphereProps {
  node: ActiveNode;
}

function GlowingSphere({ node }: GlowingSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseScale = 0.4 + node.intensity * 0.8;
  const color = METRIC_COLORS[node.category] ?? "#ffffff";

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const pulse = 1 + 0.1 * Math.sin(clock.elapsedTime * 2 + node.intensity * Math.PI);
    const scale = baseScale * pulse;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh
      ref={meshRef}
      position={node.position}
      scale={baseScale}
    >
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={node.intensity * 1.2}
        transparent
        opacity={0.3 + node.intensity * 0.35}
        depthWrite={false}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// ParticleStream — animated particles flowing between two connected nodes
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 20;

interface ParticleStreamProps {
  connection: Connection;
  index: number;
}

function ParticleStream({ connection, index }: ParticleStreamProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, geometry } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(PARTICLE_COUNT * 3);

    // Spread particles evenly along the path as initial positions
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / PARTICLE_COUNT;
      pos[i * 3] = connection.start.x + (connection.end.x - connection.start.x) * t;
      pos[i * 3 + 1] = connection.start.y + (connection.end.y - connection.start.y) * t;
      pos[i * 3 + 2] = connection.start.z + (connection.end.z - connection.start.z) * t;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { positions: pos, geometry: geo };
  }, [connection]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const posAttr = pointsRef.current.geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;

    const time = clock.elapsedTime;
    // Stagger streams by index so they don't all look identical
    const streamOffset = index * 0.37;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Each particle has a phase based on its index; combined with time it
      // produces a continuously flowing offset in [0, 1).
      const t = ((i / PARTICLE_COUNT + time * 0.3 + streamOffset) % 1 + 1) % 1;

      posAttr.setXYZ(
        i,
        connection.start.x + (connection.end.x - connection.start.x) * t,
        connection.start.y + (connection.end.y - connection.start.y) * t,
        connection.start.z + (connection.end.z - connection.start.z) * t
      );
    }

    posAttr.needsUpdate = true;
  });

  // Keep the geometry reference stable; positions buffer is the same object.
  void positions;

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.8}
        color="#7dd3fc"
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// NeuralPathways — main component
// ---------------------------------------------------------------------------

interface NeuralPathwaysProps {
  regions: BrainRegions;
  frame: FrameScores | null;
}

export function NeuralPathways({ regions, frame }: NeuralPathwaysProps) {
  const activeNodes = useMemo<ActiveNode[]>(() => {
    if (!frame) return [];

    const roiValues = frame.roi_values;
    const entries = Object.entries(roiValues);

    // Filter to entries that exist in the regions map
    const valid = entries.filter(([key]) => key in regions.regions);

    if (valid.length === 0) return [];

    // Sort descending by value
    const sorted = [...valid].sort(([, a], [, b]) => b - a);

    // Take top 15
    const top15 = sorted.slice(0, 15);

    // Normalise intensity against the maximum value
    const maxValue = top15[0][1];
    const normalise = maxValue > 0 ? (v: number) => v / maxValue : () => 0;

    return top15.map(([key, value]) => {
      const info = regions.regions[key];
      return {
        regionKey: key,
        name: info.name,
        category: info.category,
        position: new THREE.Vector3(...info.centroid),
        intensity: normalise(value),
      };
    });
  }, [regions, frame]);

  const connections = useMemo<Connection[]>(() => {
    const results: Connection[] = [];

    for (let i = 0; i < activeNodes.length; i++) {
      for (let j = i + 1; j < activeNodes.length; j++) {
        const a = activeNodes[i];
        const b = activeNodes[j];

        if (
          a.category === b.category &&
          a.intensity > 0.3 &&
          b.intensity > 0.3
        ) {
          results.push({
            start: a.position,
            end: b.position,
            category: a.category,
          });

          if (results.length >= 20) return results;
        }
      }
    }

    return results;
  }, [activeNodes]);

  return (
    <group>
      {activeNodes.map((node) => (
        <GlowingSphere key={node.regionKey} node={node} />
      ))}
      {connections.map((connection, i) => (
        <ParticleStream
          key={`${connection.category}-${i}`}
          connection={connection}
          index={i}
        />
      ))}
    </group>
  );
}
