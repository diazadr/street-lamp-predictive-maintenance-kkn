"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";

/**
 * Model 3D lampu jalan tenaga surya — dibangun prosedural (tanpa file GLB) agar:
 *  - warna mengikuti identitas putih & hijau,
 *  - setiap komponen (kepala LED, panel surya, baterai, kontroler IoT) bisa
 *    "di-explode" secara independen untuk penjelasan teknologi,
 *  - ringan dimuat (tidak ada aset 1,6 MB).
 *
 * Satuan: 1 unit ≈ 1 meter. Tanah berada di y = 0, lengan lampu mengarah ke +X.
 */

export type LampPart = "lamp" | "solar" | "battery" | "controller";

export const LAMP_PARTS: LampPart[] = ["lamp", "solar", "battery", "controller"];

interface StreetLampModelProps {
  /** 0 = terpasang, 1 = terurai penuh */
  explode?: number;
  /** Komponen yang disorot (diberi rona hijau & label tebal) */
  activePart?: LampPart | null;
  /** Intensitas nyala LED, 0..1 */
  lightOn?: number;
  /** Tampilkan label komponen saat terurai */
  labels?: Partial<Record<LampPart, string>>;
  /** Mode gelap — mempengaruhi kekuatan berkas cahaya */
  isDark?: boolean;
}

// Arah pergeseran setiap komponen saat exploded view
const EXPLODE_OFFSET: Record<LampPart, THREE.Vector3> = {
  lamp: new THREE.Vector3(1.0, 0.55, 0.15),
  solar: new THREE.Vector3(-0.15, 1.15, 0.1),
  battery: new THREE.Vector3(-1.05, 0.15, 0.9),
  controller: new THREE.Vector3(0.85, -0.25, 1.15),
};

// aksen kuning matahari pada tiang/kepala, navy untuk detail gelap
const BRAND_ACCENT = "#f5b700";
const BRAND_NAVY = "#0f2557";

const POLE_BOTTOM = 0.36;
const POLE_HEIGHT = 5.6;
const POLE_TOP = POLE_BOTTOM + POLE_HEIGHT;
const POLE_R_BOTTOM = 0.13;
const POLE_R_TOP = 0.075;
/** Jari-jari tiang pada ketinggian y (tiang meruncing) */
const poleRadiusAt = (y: number) => POLE_R_BOTTOM - ((y - POLE_BOTTOM) / POLE_HEIGHT) * (POLE_R_BOTTOM - POLE_R_TOP);

/** Tekstur sel surya monokristalin digambar di canvas (tanpa unduhan aset). */
function useSolarTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cols = 8;
    const rows = 5;
    const gap = 6;
    const cw = (canvas.width - gap * (cols + 1)) / cols;
    const ch = (canvas.height - gap * (rows + 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gap + c * (cw + gap);
        const y = gap + r * (ch + gap);
        const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
        g.addColorStop(0, "#1e3a5f");
        g.addColorStop(0.55, "#0f2340");
        g.addColorStop(1, "#0b1a30");
        ctx.fillStyle = g;
        // sel monokristalin berujung terpotong (chamfer)
        const k = 7;
        ctx.beginPath();
        ctx.moveTo(x + k, y);
        ctx.lineTo(x + cw - k, y);
        ctx.lineTo(x + cw, y + k);
        ctx.lineTo(x + cw, y + ch - k);
        ctx.lineTo(x + cw - k, y + ch);
        ctx.lineTo(x + k, y + ch);
        ctx.lineTo(x, y + ch - k);
        ctx.lineTo(x, y + k);
        ctx.closePath();
        ctx.fill();
        // busbar
        ctx.strokeStyle = "rgba(203,213,225,0.55)";
        ctx.lineWidth = 1.4;
        for (let b = 1; b <= 3; b++) {
          const bx = x + (cw / 4) * b;
          ctx.beginPath();
          ctx.moveTo(bx, y + 2);
          ctx.lineTo(bx, y + ch - 2);
          ctx.stroke();
        }
        // finger tipis
        ctx.strokeStyle = "rgba(148,163,184,0.18)";
        ctx.lineWidth = 0.6;
        for (let f = 1; f < 10; f++) {
          const fy = y + (ch / 10) * f;
          ctx.beginPath();
          ctx.moveTo(x + 2, fy);
          ctx.lineTo(x + cw - 2, fy);
          ctx.stroke();
        }
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Material cat putih per-komponen (dipisah agar bisa diberi rona saat disorot). */
function usePaintMaterials() {
  return useMemo(() => {
    const make = () =>
      new THREE.MeshStandardMaterial({
        color: "#f8fafc",
        roughness: 0.32,
        metalness: 0.18,
        emissive: new THREE.Color(BRAND_ACCENT),
        emissiveIntensity: 0,
      });
    return {
      pole: make(),
      lamp: make(),
      solar: make(),
      battery: make(),
      controller: make(),
    } as Record<"pole" | LampPart, THREE.MeshStandardMaterial>;
  }, []);
}

/**
 * Material titik LED bersama. Objek Three.js memang dimutasi per frame di useFrame
 * (bukan state React), jadi dibuat lewat hook tersendiri.
 */
function useLedDotMaterial() {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fffdf5", emissive: new THREE.Color("#fff7e0"), emissiveIntensity: 3 }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

function PartLabel({ text, active, position }: { text: string; active: boolean; position: [number, number, number] }) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div
        style={{
          whiteSpace: "nowrap",
          padding: active ? "5px 12px" : "3px 9px",
          borderRadius: 999,
          fontFamily: "var(--font-sans), system-ui, sans-serif",
          fontSize: active ? 12 : 11,
          opacity: active ? 1 : 0.85,
          fontWeight: active ? 700 : 600,
          color: active ? "#ffffff" : "#0f2557",
          background: active ? "#0f2557" : "rgba(255,253,248,0.94)",
          border: `1px solid ${active ? "#0f2557" : "#a9b8dc"}`,
          boxShadow: "0 6px 20px -8px rgba(15,37,87,0.45)",
          transition: "all .3s ease",
        }}
      >
        {text}
      </div>
    </Html>
  );
}

export default function StreetLampModel({
  explode = 0,
  activePart = null,
  lightOn = 1,
  labels,
  isDark = false,
}: StreetLampModelProps) {
  const solarTexture = useSolarTexture();
  const paint = usePaintMaterials();

  const lampGroup = useRef<THREE.Group>(null);
  const solarGroup = useRef<THREE.Group>(null);
  const batteryGroup = useRef<THREE.Group>(null);
  const controllerGroup = useRef<THREE.Group>(null);
  const ledMat = useRef<THREE.MeshStandardMaterial>(null);
  const ledDotMat = useLedDotMaterial();
  const ledDotsGroup = useRef<THREE.Group>(null);
  const statusLed = useRef<THREE.MeshStandardMaterial>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const smooth = useRef({ explode, light: lightOn });

  // Target sorot lampu (diletakkan di tanah di bawah kepala lampu)
  const spotTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(2.05, 0, 0);
    return o;
  }, []);

  useEffect(() => {
    if (spot.current) spot.current.target = spotTarget;
  }, [spotTarget]);

  // Geometri statis
  const poleGeo = useMemo(() => new THREE.CylinderGeometry(POLE_R_TOP, POLE_R_BOTTOM, POLE_HEIGHT, 32), []);
  const armGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, POLE_TOP - 0.42, 0),
      new THREE.Vector3(0.15, POLE_TOP + 0.12, 0),
      new THREE.Vector3(1.5, POLE_TOP + 0.08, 0)
    );
    return new THREE.TubeGeometry(curve, 48, 0.045, 16, false);
  }, []);
  const beamGeo = useMemo(() => new THREE.ConeGeometry(1.55, POLE_TOP - 0.1, 48, 1, true), []);

  const ledDots = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) pts.push([-0.4 + i * 0.1, -0.1 + j * 0.1]);
    return pts;
  }, []);

  useFrame((state, delta) => {
    const s = smooth.current;
    const k = 1 - Math.pow(0.0015, delta); // lerp halus, tak tergantung frame-rate
    s.explode += (explode - s.explode) * k;
    s.light += (lightOn - s.light) * k;

    // Posisi komponen saat exploded
    const groups: Record<LampPart, THREE.Group | null> = {
      lamp: lampGroup.current,
      solar: solarGroup.current,
      battery: batteryGroup.current,
      controller: controllerGroup.current,
    };
    LAMP_PARTS.forEach((part) => {
      const g = groups[part];
      if (!g) return;
      const off = EXPLODE_OFFSET[part];
      g.position.set(off.x * s.explode, off.y * s.explode, off.z * s.explode);
    });

    // Rona sorot komponen aktif
    (LAMP_PARTS as LampPart[]).forEach((part) => {
      const mat = paint[part];
      const target = activePart === part ? 0.22 + Math.sin(state.clock.elapsedTime * 3) * 0.06 : 0;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * k;
    });

    // Nyala LED + sedikit "napas"
    const breathe = 0.92 + Math.sin(state.clock.elapsedTime * 1.4) * 0.08;
    const light = s.light * breathe;
    if (ledMat.current) ledMat.current.emissiveIntensity = 0.15 + light * (isDark ? 4 : 1.6);
    // material dipakai bersama semua titik, cukup ubah dari mesh pertama
    const dot = ledDotsGroup.current?.children[0] as THREE.Mesh | undefined;
    if (dot) (dot.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + light * 3.2;
    if (spot.current) spot.current.intensity = light * (isDark ? 45 : 18);
    if (beamMat.current) beamMat.current.opacity = light * (isDark ? 0.11 : 0.05) * (1 - s.explode);

    // LED status ESP32 berkedip (heartbeat telemetri)
    if (statusLed.current) {
      const t = state.clock.elapsedTime % 1.6;
      statusLed.current.emissiveIntensity = t < 0.12 || (t > 0.25 && t < 0.37) ? 4 : 0.4;
    }
  });

  const label = (part: LampPart) => labels?.[part];
  const showLabels = !!labels && explode > 0.35;

  return (
    <group>
      {/* ── Pondasi & base plate ──────────────────────────── */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.52, 0.56, 0.3, 40]} />
        <meshStandardMaterial color={isDark ? "#3a4566" : "#e7e2d6"} roughness={0.95} />
      </mesh>
      <RoundedBox args={[0.62, 0.06, 0.62]} radius={0.02} position={[0, 0.33, 0]} castShadow material={paint.pole} />
      {[
        [0.22, 0.22],
        [-0.22, 0.22],
        [0.22, -0.22],
        [-0.22, -0.22],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.385, z]} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 0.05, 6]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 0.55, 0]} castShadow material={paint.pole}>
        <cylinderGeometry args={[0.15, 0.19, 0.36, 32]} />
      </mesh>

      {/* ── Tiang meruncing + aksen hijau ─────────────────── */}
      <mesh geometry={poleGeo} position={[0, POLE_BOTTOM + POLE_HEIGHT / 2, 0]} castShadow receiveShadow material={paint.pole} />
      {[1.25, 1.42].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[poleRadiusAt(y) + 0.006, poleRadiusAt(y) + 0.006, 0.06, 32]} />
          <meshStandardMaterial color={BRAND_ACCENT} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, POLE_TOP - 0.25, 0]}>
        <cylinderGeometry args={[poleRadiusAt(POLE_TOP - 0.25) + 0.008, poleRadiusAt(POLE_TOP - 0.25) + 0.008, 0.1, 32]} />
        <meshStandardMaterial color={BRAND_ACCENT} roughness={0.4} />
      </mesh>
      <mesh position={[0, POLE_TOP, 0]} material={paint.pole}>
        <sphereGeometry args={[POLE_R_TOP + 0.01, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* ── Kepala lampu LED + lengan ─────────────────────── */}
      <group ref={lampGroup}>
        <mesh geometry={armGeo} castShadow material={paint.lamp} />
        <group position={[2.05, POLE_TOP + 0.06, 0]} rotation={[0, 0, -0.07]}>
          {/* rumah lampu */}
          <RoundedBox args={[1.15, 0.16, 0.46]} radius={0.07} smoothness={4} castShadow material={paint.lamp} />
          {/* sambungan ke lengan */}
          <mesh position={[-0.6, 0.0, 0]} rotation={[0, 0, Math.PI / 2]} material={paint.lamp}>
            <cylinderGeometry args={[0.06, 0.06, 0.12, 20]} />
          </mesh>
          {/* strip hijau di atas */}
          <mesh position={[0.05, 0.081, 0]}>
            <boxGeometry args={[0.9, 0.01, 0.07]} />
            <meshStandardMaterial color={BRAND_ACCENT} roughness={0.35} />
          </mesh>
          {/* sensor cahaya / PIR */}
          <mesh position={[0.38, 0.08, 0]} material={paint.lamp}>
            <sphereGeometry args={[0.055, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0.38, 0.083, 0]}>
            <sphereGeometry args={[0.035, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial color="#e2e8f0" roughness={0.1} transmission={0.6} thickness={0.05} />
          </mesh>
          {/* panel LED bawah */}
          <mesh position={[0.02, -0.082, 0]}>
            <boxGeometry args={[0.98, 0.012, 0.36]} />
            <meshStandardMaterial ref={ledMat} color="#fffbeb" emissive="#fff4d6" emissiveIntensity={1.5} roughness={0.25} />
          </mesh>
          <group ref={ledDotsGroup}>
            {ledDots.map(([x, z]) => (
              <mesh key={`${x}-${z}`} position={[x + 0.02, -0.0895, z]} rotation={[Math.PI / 2, 0, 0]} material={ledDotMat}>
                <circleGeometry args={[0.028, 16]} />
              </mesh>
            ))}
          </group>
        </group>
        {showLabels && label("lamp") && <PartLabel text={label("lamp")!} active={activePart === "lamp"} position={[2.3, POLE_TOP + 0.45, 0]} />}
      </group>

      {/* Cahaya & berkas sorot */}
      <spotLight ref={spot} position={[2.05, POLE_TOP - 0.05, 0]} angle={0.62} penumbra={0.85} distance={9} decay={1.6} color="#fff4d6" castShadow={false} />
      <primitive object={spotTarget} />
      <mesh geometry={beamGeo} position={[2.05, (POLE_TOP - 0.1) / 2, 0]}>
        <meshBasicMaterial ref={beamMat} color="#fef3c7" transparent opacity={0.05} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Panel surya ───────────────────────────────────── */}
      <group ref={solarGroup}>
        <group position={[0, POLE_TOP, 0]}>
          <mesh position={[0, 0.24, 0]} castShadow material={paint.solar}>
            <cylinderGeometry args={[0.04, 0.05, 0.48, 16]} />
          </mesh>
          <group position={[0, 0.55, 0]} rotation={[0, 0.6, 0]}>
            <group rotation={[0.5, 0, 0]}>
              {/* rangka aluminium */}
              <RoundedBox args={[1.5, 0.05, 0.95]} radius={0.015} castShadow material={paint.solar} />
              {/* lis hijau di sisi bawah panel */}
              <mesh position={[0, 0, 0.476]}>
                <boxGeometry args={[1.5, 0.05, 0.012]} />
                <meshStandardMaterial color={BRAND_ACCENT} roughness={0.35} />
              </mesh>
              {/* sel surya */}
              <mesh position={[0, 0.0262, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[1.42, 0.87]} />
                <meshPhysicalMaterial map={solarTexture} roughness={0.22} metalness={0.25} clearcoat={1} clearcoatRoughness={0.08} />
              </mesh>
              {/* kotak sambung (junction box) */}
              <mesh position={[0, -0.05, -0.2]}>
                <boxGeometry args={[0.18, 0.05, 0.12]} />
                <meshStandardMaterial color={BRAND_NAVY} roughness={0.5} />
              </mesh>
            </group>
          </group>
        </group>
        {showLabels && label("solar") && <PartLabel text={label("solar")!} active={activePart === "solar"} position={[0, POLE_TOP + 1.05, 0]} />}
      </group>

      {/* ── Baterai LiFePO4 ───────────────────────────────── */}
      <group ref={batteryGroup}>
        <group position={[0, 3.35, 0]}>
          {[0.2, -0.2].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[poleRadiusAt(3.35) + 0.012, 0.014, 8, 32]} />
              <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
          <RoundedBox args={[0.46, 0.66, 0.24]} radius={0.035} smoothness={4} position={[0, 0, 0.24]} castShadow material={paint.battery} />
          {/* pita hijau label */}
          <mesh position={[0, 0.2, 0.24]}>
            <boxGeometry args={[0.465, 0.07, 0.245]} />
            <meshStandardMaterial color={BRAND_ACCENT} roughness={0.4} />
          </mesh>
          {/* indikator level baterai */}
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[-0.105 + i * 0.07, 0.04, 0.362]}>
              <boxGeometry args={[0.05, 0.05, 0.006]} />
              <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={i < 3 ? 0.9 : 0.05} />
            </mesh>
          ))}
          {/* ventilasi */}
          {[0, 1, 2, 3].map((i) => (
            <mesh key={`v${i}`} position={[0, -0.12 - i * 0.045, 0.362]}>
              <boxGeometry args={[0.28, 0.012, 0.004]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.8} />
            </mesh>
          ))}
        </group>
        {showLabels && label("battery") && <PartLabel text={label("battery")!} active={activePart === "battery"} position={[0, 3.85, 0.25]} />}
      </group>

      {/* ── Kontroler IoT ESP32 ───────────────────────────── */}
      <group ref={controllerGroup}>
        <group position={[0, 2.25, 0]}>
          {[0.13, -0.13].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[poleRadiusAt(2.25) + 0.012, 0.012, 8, 32]} />
              <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
          <RoundedBox args={[0.34, 0.42, 0.15]} radius={0.025} smoothness={4} position={[0, 0, 0.2]} castShadow material={paint.controller} />
          {/* PCB hijau di balik jendela */}
          <mesh position={[0, -0.01, 0.276]}>
            <boxGeometry args={[0.24, 0.3, 0.006]} />
            <meshStandardMaterial color="#15803d" roughness={0.6} />
          </mesh>
          <mesh position={[-0.03, 0.03, 0.282]}>
            <boxGeometry args={[0.1, 0.1, 0.01]} />
            <meshStandardMaterial color="#1f2937" roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[0.06, 0.1, 0.281]}>
            <boxGeometry args={[0.06, 0.04, 0.006]} />
            <meshStandardMaterial color="#d4a017" metalness={0.8} roughness={0.3} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[-0.09 + i * 0.045, -0.12, 0.281]}>
              <boxGeometry args={[0.02, 0.03, 0.006]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0.08, -0.05, 0.285]}>
            <sphereGeometry args={[0.014, 12, 8]} />
            <meshStandardMaterial ref={statusLed} color="#4ade80" emissive="#22c55e" emissiveIntensity={2} />
          </mesh>
          {/* tutup transparan */}
          <mesh position={[0, -0.01, 0.29]}>
            <boxGeometry args={[0.27, 0.33, 0.008]} />
            <meshPhysicalMaterial color="#ffffff" transparent opacity={0.18} roughness={0.05} clearcoat={1} />
          </mesh>
          {/* antena */}
          <mesh position={[0.12, 0.33, 0.2]} castShadow>
            <cylinderGeometry args={[0.011, 0.014, 0.26, 10]} />
            <meshStandardMaterial color="#334155" roughness={0.5} />
          </mesh>
          <mesh position={[0.12, 0.47, 0.2]}>
            <sphereGeometry args={[0.022, 12, 8]} />
            <meshStandardMaterial color={BRAND_ACCENT} roughness={0.4} />
          </mesh>
        </group>
        {showLabels && label("controller") && (
          <PartLabel text={label("controller")!} active={activePart === "controller"} position={[0, 1.7, 0.2]} />
        )}
      </group>
    </group>
  );
}
