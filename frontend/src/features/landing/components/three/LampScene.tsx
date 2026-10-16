"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import StreetLampModel, { type LampPart } from "./StreetLampModel";

interface LampSceneProps {
  isDark?: boolean;
  explode?: number;
  activePart?: LampPart | null;
  labels?: Partial<Record<LampPart, string>>;
  /** Hero: bisa diputar & berotasi otomatis. Exploded: kamera mengikuti komponen aktif. */
  mode?: "hero" | "exploded";
  /** Rotasi tambahan (radian) yang dikendalikan dari luar, mis. progres scroll section */
  spin?: MotionValue<number>;
  className?: string;
}

// Titik fokus kamera untuk setiap komponen di mode exploded
const FOCUS: Record<LampPart | "overview", { target: [number, number, number]; position: [number, number, number] }> = {
  overview: { target: [0.5, 3.4, 0.2], position: [7.4, 6.4, 10.6] },
  lamp: { target: [2.3, 6.2, 0.1], position: [6.6, 8.0, 6.4] },
  solar: { target: [-0.1, 7.0, 0.1], position: [4.2, 8.8, 6.3] },
  battery: { target: [-0.9, 3.6, 0.9], position: [3.4, 5.3, 7.2] },
  controller: { target: [0.8, 2.1, 1.15], position: [5.1, 3.8, 7.4] },
};

/** Animasi kamera halus menuju komponen yang sedang dibahas. */
function CameraRig({ activePart, explode }: { activePart: LampPart | null; explode: number }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(...FOCUS.overview.target));
  const desiredPos = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const focus = activePart && explode > 0.3 ? FOCUS[activePart] : FOCUS.overview;
    desiredPos.set(...focus.position);
    desiredTarget.set(...focus.target);
    const k = 1 - Math.pow(0.02, delta);
    camera.position.lerp(desiredPos, k);
    target.current.lerp(desiredTarget, k);
    camera.lookAt(target.current);
  });
  return null;
}

function Ground({ isDark }: { isDark: boolean }) {
  const bushes = useMemo(
    () =>
      [
        { a: 0.5, r: 2.05, s: 0.34 },
        { a: 0.95, r: 2.25, s: 0.24 },
        { a: 2.6, r: 2.1, s: 0.3 },
        { a: 3.0, r: 2.3, s: 0.22 },
        { a: 4.2, r: 2.05, s: 0.36 },
        { a: 4.6, r: 2.3, s: 0.24 },
        { a: 5.6, r: 2.15, s: 0.28 },
      ].map((b) => ({ ...b, x: Math.cos(b.a) * b.r, z: Math.sin(b.a) * b.r })),
    []
  );

  return (
    <group>
      {/* rumput */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <circleGeometry args={[3.05, 72]} />
        <meshStandardMaterial color={isDark ? "#1a2a33" : "#d6e2b8"} roughness={1} />
      </mesh>
      {/* tepi plinth */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <cylinderGeometry args={[3.1, 3.15, 0.12, 72]} />
        <meshStandardMaterial color={isDark ? "#1a2540" : "#efeadf"} roughness={0.9} />
      </mesh>
      {/* paving di sekitar tiang */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <circleGeometry args={[1.25, 64]} />
        <meshStandardMaterial color={isDark ? "#26314f" : "#fbf8f1"} roughness={0.85} />
      </mesh>
      {/* jalur jalan kecil ke arah sorot lampu */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.1, 0.006, 0]} receiveShadow>
        <planeGeometry args={[2.0, 0.9]} />
        <meshStandardMaterial color={isDark ? "#26314f" : "#fbf8f1"} roughness={0.85} />
      </mesh>
      {bushes.map((b, i) => (
        <mesh key={i} position={[b.x, b.s * 0.75, b.z]} scale={[b.s, b.s * 0.85, b.s]} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={i % 2 ? "#8fae4c" : "#7a9a3c"} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function SceneContent({ isDark = false, explode = 0, activePart = null, labels, mode = "hero", spin }: LampSceneProps) {
  const lampGroup = useRef<THREE.Group>(null);

  // Hero: ayunan lembut agar terasa hidup tanpa terlihat "futuristik"
  useFrame((state) => {
    if (mode === "hero" && lampGroup.current) {
      lampGroup.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.12 + (spin?.get() ?? 0);
    }
  });

  return (
    <>
      <ambientLight intensity={isDark ? 0.25 : 0.55} />
      <hemisphereLight args={[isDark ? "#334155" : "#ffffff", isDark ? "#0f2557" : "#e8dfc4", isDark ? 0.35 : 0.7]} />
      <directionalLight
        position={[6, 11, 7]}
        intensity={isDark ? 0.45 : 1.7}
        color={isDark ? "#c7d2fe" : "#fffaf0"}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={9}
        shadow-camera-bottom={-3}
        shadow-bias={-0.0004}
      />

      {/* Refleksi lembut tanpa unduhan HDRI */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={isDark ? 0.6 : 1.6} position={[0, 6, -6]} scale={[12, 6, 1]} color="#ffffff" />
        <Lightformer intensity={isDark ? 0.3 : 0.9} position={[-6, 3, 2]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} color="#fff3d0" />
        <Lightformer intensity={isDark ? 0.3 : 0.8} position={[6, 3, 2]} rotation-y={-Math.PI / 2} scale={[8, 4, 1]} color="#ffffff" />
      </Environment>

      <group ref={lampGroup} position={[0, 0, 0]}>
        <StreetLampModel explode={explode} activePart={activePart} labels={labels} lightOn={isDark ? 1 : 0.75} isDark={isDark} />
      </group>
      <Ground isDark={isDark} />
      <ContactShadows position={[0, 0.008, 0]} opacity={isDark ? 0.5 : 0.32} scale={7} blur={2.4} far={6} color="#0f2557" />

      {mode === "hero" ? (
        <OrbitControls
          target={[0.7, 3.25, 0]}
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
          minPolarAngle={Math.PI / 3.2}
          maxPolarAngle={Math.PI / 2.05}
          enableDamping
        />
      ) : (
        <CameraRig activePart={activePart} explode={explode} />
      )}
    </>
  );
}

export default function LampScene(props: LampSceneProps) {
  const initial = props.mode === "exploded" ? FOCUS.overview.position : ([7.6, 6.2, 10.8] as [number, number, number]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // Hentikan render saat canvas tidak terlihat agar hemat GPU/baterai
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className={props.className}>
    <Canvas
      frameloop={visible ? "always" : "never"}
      shadows
      dpr={[1, 2]}
      camera={{ position: initial, fov: 38, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ touchAction: props.mode === "hero" ? "pan-y" : "auto" }}
    >
      <Suspense fallback={null}>
        <SceneContent {...props} />
      </Suspense>
    </Canvas>
    </div>
  );
}
