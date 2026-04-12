import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { Grid, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore, MapDesign } from '../store';

// ─── Textures ───────────────────────────────────────────────

const createHexTexture = (repeat = 10) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0,0,512,512);
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 4;
    
    const a = 2 * Math.PI / 6;
    const r = 32;
    for (let y = 0; y < 512 + r; y += r * Math.sin(a)) {
      for (let x = 0, j=0; x < 512 + r; x += r * (1 + Math.cos(a)), y += (-1)**j++ * r * Math.sin(a)) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            ctx.lineTo(x + r * Math.cos(a * i), y + r * Math.sin(a * i));
        }
        ctx.closePath(); ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas); 
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; 
  tex.repeat.set(repeat, repeat);
  return tex;
};

const createGratingTexture = (repeat = 10) => {
  const canvas = document.createElement('canvas'); 
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1e293b'; ctx.fillRect(0,0,512,512);
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 8;
    for(let i=0; i<512; i+=32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas); 
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; 
  tex.repeat.set(repeat, repeat);
  return tex;
};

const createStoneTexture = (repeat = 10) => {
  const canvas = document.createElement('canvas'); 
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f3028'; ctx.fillRect(0,0,512,512);
    ctx.fillStyle = '#061a14';
    for(let i=0; i<512; i+=64) {
      for(let j=0; j<512; j+=64) {
        if ((i+j)%128===0) ctx.fillRect(i+2, j+2, 60, 60);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas); 
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; 
  tex.repeat.set(repeat, repeat);
  return tex;
};

const createCheckerTexture = (color1: string, color2: string, repeat: number = 10) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color1; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = color2;
    for (let i = 0; i < 512; i += 64) {
      for (let j = 0; j < 512; j += 64) {
        if ((i / 64 + j / 64) % 2 === 0) ctx.fillRect(i, j, 64, 64);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
};

const createLavaTexture = (repeat = 10) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grd = ctx.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#581c0c');
    grd.addColorStop(0.5, '#ea580c');
    grd.addColorStop(1, '#9a3412');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 512, 512);
    // Draw some stylized magma cracks
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    for (let i=0; i<10; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random()*512, 0);
      ctx.lineTo(Math.random()*512, 256);
      ctx.lineTo(Math.random()*512, 512);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
};

const createEnergyTexture = (repeat = 10) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 10;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 20;
    for (let i=0; i<512; i+=64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
};


// ─── Kinetic Props ──────────────────────────────────────────────

const KineticTurbine = ({ position, rotationSpeed = 1, axis = 'y', scale = 1 }: { position: [number,number,number], rotationSpeed?: number, axis?: 'x'|'y'|'z', scale?: number }) => {
  const ref = useRef<RapierRigidBody>(null);
  
  useFrame((state) => {
    if (ref.current) {
      const angle = state.clock.elapsedTime * rotationSpeed;
      const vAxis = axis === 'x' ? new THREE.Vector3(1,0,0) : axis === 'y' ? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
      const q = new THREE.Quaternion().setFromAxisAngle(vAxis, angle);
      ref.current.setNextKinematicRotation(q);
    }
  });

  return (
    <RigidBody ref={ref} type="kinematicPosition" position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[16 * scale, 1 * scale, 2 * scale]} />
        <meshStandardMaterial color="#334155" metalness={0.8} />
      </mesh>
      <mesh castShadow receiveShadow rotation={[0, Math.PI/2, 0]}>
        <boxGeometry args={[16 * scale, 1 * scale, 2 * scale]} />
        <meshStandardMaterial color="#334155" metalness={0.8} />
      </mesh>
    </RigidBody>
  );
};

// ─── Map Designs ───────────────────────────────────────────────

const ThePit = ({ size }: { size: number }) => {
  const s = size / 2;
  const tex = useMemo(() => createCheckerTexture('#1a0f0a', '#280909', size/10), [size]);
  const rampAng = 0.35; // slope angle
  const pDrop = -8; // pit depth
  
  return (
    <group>
      {/* Outer Elevated Ring (Y=0 top) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, -2, -s + 6]} receiveShadow><boxGeometry args={[size, 4, 12]} /><meshStandardMaterial color="#3a1c1c" /></mesh>
        <mesh position={[0, -2, s - 6]} receiveShadow><boxGeometry args={[size, 4, 12]} /><meshStandardMaterial color="#3a1c1c" /></mesh>
        <mesh position={[-s + 6, -2, 0]} receiveShadow><boxGeometry args={[12, 4, size - 24]} /><meshStandardMaterial color="#3a1c1c" /></mesh>
        <mesh position={[s - 6, -2, 0]} receiveShadow><boxGeometry args={[12, 4, size - 24]} /><meshStandardMaterial color="#3a1c1c" /></mesh>
        {/* Corner Base Pads */}
        {[[-1,-1], [1,-1], [-1,1], [1,1]].map(([x,z], i) => (
           <mesh key={i} position={[x * (s-10), -0.5, z * (s-10)]} receiveShadow>
             <boxGeometry args={[20, 1, 20]} /><meshStandardMaterial color="#ef4444" metalness={0.5} roughness={0.5} />
           </mesh>
        ))}
      </RigidBody>
      
      <group>
      {/* 4 Ramps down to center pit */}
      <RigidBody type="fixed" colliders="cuboid" rotation={[rampAng, 0, 0]} position={[0, pDrop/2 - 0.5, -s + 18]}>
        <mesh receiveShadow><boxGeometry args={[16, 1, 24]} /><meshStandardMaterial color="#2d0a0a" /></mesh>
      </RigidBody>
      {/* Under-ramp pillars */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, pDrop/2 - 2, -s + 20]}>
        <mesh receiveShadow><boxGeometry args={[14, Math.abs(pDrop), 4]} /><meshStandardMaterial color="#1a0f0a" /></mesh>
      </RigidBody>
      
      <RigidBody type="fixed" colliders="cuboid" rotation={[-rampAng, 0, 0]} position={[0, pDrop/2 - 0.5, s - 18]}>
        <mesh receiveShadow><boxGeometry args={[16, 1, 24]} /><meshStandardMaterial color="#2d0a0a" /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" position={[0, pDrop/2 - 2, s - 20]}>
        <mesh receiveShadow><boxGeometry args={[14, Math.abs(pDrop), 4]} /><meshStandardMaterial color="#1a0f0a" /></mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, -rampAng]} position={[-s + 18, pDrop/2 - 0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[24, 1, 16]} /><meshStandardMaterial color="#2d0a0a" /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, rampAng]} position={[s - 18, pDrop/2 - 0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[24, 1, 16]} /><meshStandardMaterial color="#2d0a0a" /></mesh>
      </RigidBody>
      </group>

      {/* Central Cover Structure */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, pDrop + 4, 0]}>
         <mesh receiveShadow castShadow><boxGeometry args={[10, 8, 10]} /><meshStandardMaterial color="#1a0f0a" /></mesh>
      </RigidBody>
    </group>
  );
};

const Crossfire = ({ size }: { size: number }) => {
  const tex = useMemo(() => createGratingTexture(size/10), [size]);
  const hs = size / 2;
  return (
    <group>
      {/* Corner Islands (Y=0) */}
      <RigidBody type="fixed" colliders="cuboid">
      {[[-1,-1], [-1,1], [1,-1], [1,1]].map(([x,z], i) => (
          <mesh key={i} receiveShadow castShadow position={[x * hs * 0.65, -10, z * hs * 0.65]}>
              <boxGeometry args={[24, 20, 24]} /><meshStandardMaterial map={tex} />
          </mesh>
      ))}
      </RigidBody>

      {/* Connecting crossing bridges */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[size * 0.8, 1, 8]} /><meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.2} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[8, 1, size * 0.8]} /><meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.2} /></mesh>
      </RigidBody>

      {/* Center Platform (slightly raised) */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 0, 0]}>
        <mesh receiveShadow><cylinderGeometry args={[12, 12, 2, 16]} rotation={[0,0,0]} /><meshStandardMaterial color="#0a1930" metalness={0.8} /></mesh>
      </RigidBody>

      {/* Kinetic Turbines underneath bridges */}
      <KineticTurbine position={[0, -4, 0]} rotationSpeed={2} scale={1.5} />
      <KineticTurbine position={[-15, -0.5, 0]} rotationSpeed={1.5} axis="x" scale={0.7} />
      <KineticTurbine position={[15, -0.5, 0]} rotationSpeed={1.5} axis="x" scale={0.7} />

    </group>
  );
};

const Highrise = ({ size }: { size: number }) => {
  const tex = useMemo(() => createHexTexture(size/5), [size]);
  const hs = size / 2;
  return (
    <group>
      {/* Base Level (Y=0) where bases are */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[size, 1, size]} /><meshStandardMaterial map={tex} /></mesh>
      </RigidBody>

      {/* Tower Tier 1 */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 4, 0]}>
        <mesh receiveShadow castShadow><boxGeometry args={[size * 0.6, 8, size * 0.6]} /><meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.3} /></mesh>
      </RigidBody>
      {/* Tier 1 Cover */}
      {[[-1,-1], [1,-1], [-1,1], [1,1]].map(([x,z], i) => (
         <RigidBody key={i} type="fixed" colliders="cuboid" position={[x * hs * 0.5, 10, z * hs * 0.5]}>
            <mesh receiveShadow castShadow><boxGeometry args={[4, 4, 4]} /><meshStandardMaterial color="#38bdf8" /></mesh>
         </RigidBody>
      ))}

      {/* Tower Tier 2 */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 12, 0]}>
        <mesh receiveShadow castShadow><boxGeometry args={[size * 0.3, 8, size * 0.3]} /><meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.1} /></mesh>
      </RigidBody>

      {/* Ramps from Base to Tier 1 */}
      <RigidBody type="fixed" colliders="cuboid" rotation={[0.4, 0, 0]} position={[0, 4, hs * 0.6 + 2]}>
        <mesh receiveShadow><boxGeometry args={[12, 1, 20]} /><meshStandardMaterial color="#334155" /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[-0.4, 0, 0]} position={[0, 4, -hs * 0.6 - 2]}>
        <mesh receiveShadow><boxGeometry args={[12, 1, 20]} /><meshStandardMaterial color="#334155" /></mesh>
      </RigidBody>
      
      {/* Ramps from Tier 1 to Tier 2 (East/West) */}
      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, 0.4]} position={[hs * 0.3 + 2, 12, 0]}>
        <mesh receiveShadow><boxGeometry args={[20, 1, 8]} /><meshStandardMaterial color="#475569" /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, -0.4]} position={[-hs * 0.3 - 2, 12, 0]}>
        <mesh receiveShadow><boxGeometry args={[20, 1, 8]} /><meshStandardMaterial color="#475569" /></mesh>
      </RigidBody>
    </group>
  );
};

const Fortress = ({ size }: { size: number }) => {
  const tex = useMemo(() => createStoneTexture(size/10), [size]);
  const hs = size / 2;
  return (
    <group>
      {/* Ground (Y=0) */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[size, 1, size]} /><meshStandardMaterial map={tex} /></mesh>
      </RigidBody>

      {/* Massive walls forming courtyards */}
      <RigidBody type="fixed" colliders="cuboid">
        {/* Central Cross Walls */}
        <mesh position={[0, 6, 0]} receiveShadow castShadow><boxGeometry args={[size * 0.6, 12, 4]} /><meshStandardMaterial color="#0f3028" /></mesh>
        <mesh position={[0, 6, 0]} receiveShadow castShadow><boxGeometry args={[4, 12, size * 0.6]} /><meshStandardMaterial color="#0f3028" /></mesh>
        
        {/* Courtyard Outer Corners */}
        {[[-1,-1], [-1,1], [1,-1], [1,1]].map(([x,z], i) => (
            <group key={i}>
                <mesh position={[x * hs * 0.8, 6, z * hs * 0.4]} receiveShadow castShadow><boxGeometry args={[4, 12, size * 0.2]} /><meshStandardMaterial color="#0f3028" /></mesh>
                <mesh position={[x * hs * 0.4, 6, z * hs * 0.8]} receiveShadow castShadow><boxGeometry args={[size * 0.2, 12, 4]} /><meshStandardMaterial color="#0f3028" /></mesh>
            </group>
        ))}

        {/* Center Obelisk */}
        <mesh position={[0, 12, 0]} receiveShadow castShadow><cylinderGeometry args={[2, 4, 24, 4]} /><meshStandardMaterial color="#14b8a6" /></mesh>
      </RigidBody>
    </group>
  );
};

const Orbital = ({ size }: { size: number }) => {
  const tex = useMemo(() => createEnergyTexture(size/4), [size]);
  const hs = size / 2;

  useFrame((state) => {
    tex.offset.y = -(state.clock.elapsedTime * 0.2) % 1;
  });

  return (
    <group>
      {/* Base Level platforms */}
      <RigidBody type="fixed" colliders="cuboid">
        {[[-1,-1], [1,-1], [-1,1], [1,1]].map(([x,z], i) => (
          <mesh key={i} receiveShadow position={[x * hs * 0.8, -0.5, z * hs * 0.8]}>
            <boxGeometry args={[16, 1, 16]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
      </RigidBody>

      {/* Flowing energy bridges */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[size * 0.9, 1, 6]} /><meshStandardMaterial map={tex} color="#a855f7" /></mesh>
        <mesh receiveShadow><boxGeometry args={[6, 1, size * 0.9]} /><meshStandardMaterial map={tex} color="#a855f7" /></mesh>
      </RigidBody>

      {/* Massive Gyroscope Rings */}
      <KineticTurbine position={[0, 15, 0]} rotationSpeed={0.5} axis="x" scale={1.2} />
      <KineticTurbine position={[0, 15, 0]} rotationSpeed={-0.6} axis="z" scale={1.4} />
    </group>
  );
};

const Volcano = ({ size }: { size: number }) => {
  const lavaTex = useMemo(() => createLavaTexture(size/6), [size]);
  const hs = size / 2;

  useFrame((state) => {
    lavaTex.offset.y = (state.clock.elapsedTime * 0.05) % 1;
    lavaTex.offset.x = Math.sin(state.clock.elapsedTime * 0.02) * 0.1;
  });

  return (
    <group>
      {/* Lava Lake */}
      <mesh position={[0, -2, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[size*2, size*2]} />
        <meshBasicMaterial map={lavaTex} color="#ffffff" />
      </mesh>

      {/* Safe Corner Bases */}
      <RigidBody type="fixed" colliders="cuboid">
        {[[-1,-1], [1,-1], [-1,1], [1,1]].map(([x,z], i) => (
          <mesh key={i} receiveShadow castShadow position={[x * hs * 0.8, -0.5, z * hs * 0.8]}>
            <boxGeometry args={[20, 4, 20]} />
            <meshStandardMaterial color="#292524" roughness={1} />
          </mesh>
        ))}
      </RigidBody>

      {/* The Central Peak */}
      <RigidBody type="fixed" colliders="hull" position={[0, -2, 0]}>
        <mesh receiveShadow castShadow>
          <coneGeometry args={[20, 20, 6]} />
          <meshStandardMaterial color="#1c1917" roughness={1} />
        </mesh>
      </RigidBody>

      {/* Bridges to Peak */}
      <RigidBody type="fixed" colliders="cuboid" rotation={[0.2, 0, 0]} position={[0, 2, hs * 0.5]}>
        <mesh receiveShadow><boxGeometry args={[8, 1, hs*0.8]} /><meshStandardMaterial color="#44403c" /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[-0.2, 0, 0]} position={[0, 2, -hs * 0.5]}>
        <mesh receiveShadow><boxGeometry args={[8, 1, hs*0.8]} /><meshStandardMaterial color="#44403c" /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, -0.2]} position={[hs * 0.5, 2, 0]}>
        <mesh receiveShadow><boxGeometry args={[hs*0.8, 1, 8]} /><meshStandardMaterial color="#44403c" /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, 0.2]} position={[-hs * 0.5, 2, 0]}>
        <mesh receiveShadow><boxGeometry args={[hs*0.8, 1, 8]} /><meshStandardMaterial color="#44403c" /></mesh>
      </RigidBody>
      
      {/* Physics Floor under lava for safety */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -4, 0]}>
        <mesh><boxGeometry args={[size*2, 2, size*2]} /><meshStandardMaterial transparent opacity={0} /></mesh>
      </RigidBody>
    </group>
  );
};


// ─── Obstacles Population ──────────────────────────────────────

const MapObstacles = ({ mapConfig, teams }: { mapConfig: any, teams: any[] }) => {
  const { density, size, theme } = mapConfig;
  const halfSize = size / 2;
  
  const obstacles = useMemo(() => {
    let currentSeed = mapConfig.seed * 50;
    const random = () => {
      let x = Math.sin(currentSeed++) * 10000;
      return x - Math.floor(x);
    };
    
    const obs = [];
    const step = 8;
    
    for (let x = -halfSize + 5; x < halfSize - 5; x += step) {
      for (let z = -halfSize + 5; z < halfSize - 5; z += step) {
        
        // Prevent blocking bases entirely
        let nearBase = false;
        teams.forEach(team => {
          const [bx, by, bz] = team.basePosition;
          if (Math.abs(x - bx) < 15 && Math.abs(z - bz) < 15) nearBase = true;
        });
        if (nearBase) continue;

        // Custom map density rules
        if (theme === 'The Pit' && Math.sqrt(x*x + z*z) > size*0.35) continue; // Only spawn debris in the pit
        if (theme === 'Crossfire' && Math.abs(x) > 6 && Math.abs(z) > 6) continue; // Focus around bridges
        if (theme === 'Volcano' && Math.sqrt(x*x + z*z) < 22) continue; // Keep central peak clear
        if (theme === 'Orbital' && Math.abs(x) > 8 && Math.abs(z) > 8) continue; // Focus on center bridges
        
        if (random() > (1 - density)) {
          obs.push({
            id: `${x}-${z}`,
            position: [x + (random() - 0.5) * 4, 10, z + (random() - 0.5) * 4] as [number, number, number],
            scale: 0.8 + random() * 1.5,
            rotation: random() * Math.PI
          });
        }
      }
    }
    return obs;
  }, [mapConfig, teams, halfSize, density, size, theme]);

  return (
    <group>
      {obstacles.map(obs => (
        // Dynamic boxes fall and fit on complicated geometry organically
         <RigidBody key={obs.id} type="dynamic" mass={100} position={obs.position} rotation={[0, obs.rotation, 0]}>
            <mesh castShadow receiveShadow>
               <boxGeometry args={[3*obs.scale, 3*obs.scale, 3*obs.scale]} />
               <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.8} />
            </mesh>
         </RigidBody>
      ))}
    </group>
  );
};

// ─── Blades Of Death Hazard ─────────────────────────────────────
const BladesOfDeath = ({ size }: { size: number }) => {
  const bladesRef = useRef<THREE.InstancedMesh>(null);
  
  useFrame((state) => {
    if (bladesRef.current) {
      // Violent spinning!
      const time = state.clock.elapsedTime;
      const count = bladesRef.current.count;
      const dummy = new THREE.Object3D();
      let index = 0;
      for (let x = -size*1.5; x <= size*1.5; x += 15) {
        for (let z = -size*1.5; z <= size*1.5; z += 15) {
          dummy.position.set(x, 0, z);
          // Spin flat on the ground furiously!
          dummy.rotation.set(0, time * 15 * (index % 2 === 0 ? 1 : -1), 0);
          
          // Flatten an icosahedron to make a cruel spiky sawblade
          dummy.scale.set(8, 0.4, 8);
          dummy.updateMatrix();
          if (index < count) {
            bladesRef.current.setMatrixAt(index++, dummy.matrix);
          }
        }
      }
      bladesRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group position={[0, -15, 0]}>
      {/* Dark blood mist literal floor to block infinite falls eventually */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -5, 0]}>
        <mesh>
          <boxGeometry args={[size * 4, 10, size * 4]} />
          <meshBasicMaterial color="#2d0a0a" />
        </mesh>
      </RigidBody>
      
      {/* Instanced massive spiky sawblades */}
      <instancedMesh ref={bladesRef} args={[undefined, undefined, 400]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#334155" metalness={1} roughness={0.2} emissive="#991b1b" emissiveIntensity={0.5} />
      </instancedMesh>
    </group>
  );
};

// ─── Main Component ─────────────────────────────────────────────

export const Arena: React.FC = () => {
  const mapConfig = useGameStore(state => state.mapConfig);
  const teams = useGameStore(state => state.teams);
  const { size, theme } = mapConfig;

  return (
    <group>
      {/* Map Layout */}
      {theme === 'The Pit' && <ThePit size={size} />}
      {theme === 'Crossfire' && <Crossfire size={size} />}
      {theme === 'Highrise' && <Highrise size={size} />}
      {theme === 'Fortress' && <Fortress size={size} />}
      {theme === 'Orbital' && <Orbital size={size} />}
      {theme === 'Volcano' && <Volcano size={size} />}

      {/* Map Specific Fog/Grid via Drei (Optional aesthetic layers) */}
      {theme === 'Highrise' && (
        <Grid infiniteGrid fadeDistance={size} sectionColor="#38bdf8" cellColor="#0ea5e9" position={[0, -0.4, 0]} />
      )}

      {/* Blades of death (Global Hazard except Volcano which has Lava) */}
      {theme !== 'Volcano' && <BladesOfDeath size={size} />}

      {/* Dynamic Obstacles (Debris) */}
      <MapObstacles mapConfig={mapConfig} teams={teams} />

      {/* Team Base Highlights/Towers */}
      {teams.map(team => (
        <TowerBase key={team.id} team={team} theme={theme} />
      ))}
    </group>
  );
};


const TowerBase: React.FC<{ team: any, theme: string }> = ({ team, theme }) => {
  const [x, y, z] = team.basePosition;
  
  return (
    <group position={[x, y, z]}>
      {/* Floating Rotating Energy Rings */}
      <Float speed={2} rotationIntensity={2} floatIntensity={0.5}>
         <mesh position={[0, 8, 0]}>
           <torusGeometry args={[4, 0.2, 16, 32]} />
           <meshStandardMaterial color={team.color} emissive={team.color} emissiveIntensity={2} />
         </mesh>
      </Float>
      <Float speed={3} rotationIntensity={3} floatIntensity={0.5}>
         <mesh position={[0, 5, 0]}>
           <torusGeometry args={[2.5, 0.1, 16, 32]} />
           <meshStandardMaterial color={team.color} emissive={team.color} emissiveIntensity={1.5} />
         </mesh>
      </Float>

      {/* The Beacon / Light */}
      <Float speed={4} rotationIntensity={1} floatIntensity={1}>
        <mesh position={[0, 10, 0]} castShadow>
          <octahedronGeometry args={[1.5]} />
          <meshStandardMaterial color={team.color} emissive={team.color} emissiveIntensity={4} />
        </mesh>
      </Float>
      <pointLight position={[0, 10, 0]} intensity={10} color={team.color} distance={40} />

      {/* Healing/Spawn Area Indicator */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[10, 10, 8, 32, 1, true]} />
        <meshStandardMaterial color={team.color} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
};
