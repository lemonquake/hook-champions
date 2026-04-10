import React, { useMemo } from 'react';
import { RigidBody, HeightfieldCollider } from '@react-three/rapier';
import { Grid, Float, MeshWobbleMaterial } from '@react-three/drei';
import { createNoise2D } from 'simplex-noise';
import * as THREE from 'three';
import { useGameStore } from '../store';

const createCheckerTexture = (color1: string, color2: string, repeat: number = 10) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = color2;
    for (let i = 0; i < 512; i += 64) {
      for (let j = 0; j < 512; j += 64) {
        if ((i / 64 + j / 64) % 2 === 0) {
          ctx.fillRect(i, j, 64, 64);
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
};

const createGridTexture = (bgColor: string, lineColor: string, repeat: number = 10) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 16;
    ctx.strokeRect(0, 0, 512, 512);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
};

const createRoadTexture = (repeat: number = 10) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#111827'; // Asphalt
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#facc15'; // Yellow line
    ctx.fillRect(240, 0, 32, 200);
    ctx.fillRect(240, 312, 32, 200);
    ctx.fillStyle = '#334155'; // Sidewalk edge
    ctx.fillRect(0, 0, 64, 512);
    ctx.fillRect(448, 0, 64, 512);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
};

export const Arena: React.FC = () => {
  const { seed, density, size, theme } = useGameStore(state => state.mapConfig);
  const teams = useGameStore(state => state.teams);

  // --- Terrain Generation ---
  const terrainData = useMemo(() => {
    const resolution = 32;
    const heights = new Float32Array(resolution * resolution);
    let currentSeed = seed;
    const random = () => {
      let x = Math.sin(currentSeed++) * 10000;
      return x - Math.floor(x);
    };
    const noise2D = createNoise2D(random);

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const x = (i / resolution - 0.5) * size;
        const z = (j / resolution - 0.5) * size;
        
        let h = 0;
        let noiseH = 0;
        
        if (theme === 'Jungle') {
          noiseH = noise2D(x * 0.05, z * 0.05) * 2;
        } else if (theme === 'Snow') {
          noiseH = Math.abs(noise2D(x * 0.03, z * 0.03)) * 3;
        } else if (theme === 'City') {
          const n = noise2D(x * 0.1, z * 0.1);
          noiseH = n > 0.5 ? 0.5 : 0;
        }

        const distToCenter = Math.sqrt(x * x + z * z);
        let onIslandPath = false;

        // Path (cross pattern)
        if (Math.abs(x) < 8 || Math.abs(z) < 8) {
           onIslandPath = true;
        }
        
        // Center Arena
        if (distToCenter < 20) {
           onIslandPath = true;
        }

        // 4 Corner Islands
        teams.forEach(team => {
          const [bx, by, bz] = team.basePosition;
          if (bx !== 0 || bz !== 0) {
            const distToBase = Math.sqrt(Math.pow(x - bx, 2) + Math.pow(z - bz, 2));
            if (distToBase < 22) onIslandPath = true;
          }
        });

        if (onIslandPath) {
           h = noiseH * 0.2; // High flat ground
        } else {
           h = -0.3 + noiseH * 0.1;  // Slightly lower ground (no deep chasms)
        }

        heights[i + j * resolution] = h;
      }
    }
    return { heights, resolution };
  }, [seed, size, theme, teams]);

  const terrainGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size, size, terrainData.resolution - 1, terrainData.resolution - 1);
    const vertices = geo.attributes.position.array;
    for (let i = 0; i < terrainData.heights.length; i++) {
      // PlaneGeometry vertices are ordered differently than Heightfield
      // But for simplicity, we'll map them 1:1 and adjust if needed
      // Actually, PlaneGeometry is (x, y, z) where z is height before rotation
      (vertices as any)[i * 3 + 2] = terrainData.heights[i];
    }
    geo.computeVertexNormals();
    return geo;
  }, [terrainData, size]);

  // --- Obstacle Generation ---
  const obstacles = useMemo(() => {
    let currentSeed = seed + 100;
    const random = () => {
      let x = Math.sin(currentSeed++) * 10000;
      return x - Math.floor(x);
    };
    const noise2D = createNoise2D(random);
    
    const obs = [];
    const step = 6;
    const halfSize = size / 2;
    
    for (let x = -halfSize + 5; x < halfSize - 5; x += step) {
      for (let z = -halfSize + 5; z < halfSize - 5; z += step) {
        if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
        
        // Don't spawn obstacles near team bases
        let nearBase = false;
        teams.forEach(team => {
          const [bx, by, bz] = team.basePosition;
          const distToBase = Math.sqrt(Math.pow(x - bx, 2) + Math.pow(z - bz, 2));
          if (distToBase < 25) nearBase = true; // Clear entire island
        });
        if (nearBase) continue;
        
        // Determine if on pathway or chasm to set base height
        let isChasm = true;
        if (Math.abs(x) < 8 || Math.abs(z) < 8) isChasm = false;
        if (Math.sqrt(x * x + z * z) < 20) isChasm = false;
        
        const n = noise2D(x * 0.1, z * 0.1);
        if (n > (1 - density * 2.5)) {
          const type = theme === 'Jungle' ? (random() > 0.5 ? 'tree' : 'rock') :
                       theme === 'Snow' ? (random() > 0.5 ? 'spike' : 'mound') :
                       theme === 'City' ? (random() > 0.6 ? 'building' : random() > 0.5 ? 'car' : 'dumpster') : 
                       (random() > 0.6 ? 'server' : random() > 0.5 ? 'dataPillar' : 'neonSign');
          
          obs.push({
            id: `${x}-${z}`,
            position: [x + (random() - 0.5) * 3, isChasm ? -0.3 : 0, z + (random() - 0.5) * 3] as [number, number, number],
            type,
            scale: isChasm ? 1.5 + random() * 2 : 0.8 + random() * 1.5,
            rotation: random() * Math.PI * 2
          });
        }
      }
    }
    return obs;
  }, [seed, density, size, theme]);

  const halfSize = size / 2;

  return (
    <group>
      {/* Terrain Physics & Visuals */}
      <RigidBody type="fixed" colliders="trimesh" name="floor">
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} geometry={terrainGeometry}>
          <TerrainMaterial theme={theme} size={size} />
        </mesh>
      </RigidBody>

      {/* Invisible Safety Floor - prevents falling through ANY gap */}
      <RigidBody type="fixed" colliders="cuboid" name="floor">
        <mesh position={[0, -1, 0]} receiveShadow>
          <boxGeometry args={[size + 20, 0.5, size + 20]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>

      {/* Theme-specific Grid/Atmosphere */}
      {theme === 'Cyber' && (
        <Grid 
          infiniteGrid 
          fadeDistance={size} 
          sectionColor="#00ffff" 
          cellColor="#004444" 
          position={[0, 0.05, 0]} 
        />
      )}

      {/* Outer Walls - Unique per theme */}
      <OuterWalls size={size} theme={theme} />

      {/* Team Bases */}
      {teams.map(team => (
        <TowerBase key={team.id} team={team} theme={theme} />
      ))}

      {/* Procedural Obstacles - Unique Shapes */}
      {obstacles.map((obs) => (
        <ThemeObstacle key={obs.id} {...obs} theme={theme} />
      ))}

      {/* Theme Specific Lights/Effects */}
      {theme === 'City' && <StreetLights size={size} seed={seed} />}
      {theme === 'Jungle' && <SwampMist size={size} />}
    </group>
  );
};

const TerrainMaterial = ({ theme, size }: { theme: string, size: number }) => {
  const texture = useMemo(() => {
    if (theme === 'Cyber') return createGridTexture('#050505', '#00ffff', size / 4);
    if (theme === 'City') return createRoadTexture(size / 10);
    return null;
  }, [theme, size]);

  switch (theme) {
    case 'Jungle':
      return <meshStandardMaterial color="#1a2e1a" roughness={1} metalness={0} />;
    case 'Snow':
      return <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.1} />;
    case 'City':
      return <meshStandardMaterial map={texture || undefined} roughness={0.8} metalness={0.2} />;
    default: // Cyber
      return <meshStandardMaterial map={texture || undefined} roughness={0.2} metalness={0.9} />;
  }
};

const ThemeObstacle = ({ position, type, scale, rotation, theme }: any) => {
  const height = type === 'building' ? 15 * scale : 4 * scale;
  
  return (
    <RigidBody type="fixed" colliders="cuboid" position={[position[0], height / 2, position[2]]} rotation={[0, rotation, 0]}>
      <group scale={scale}>
        {theme === 'Jungle' && (
          type === 'tree' ? (
            <group>
              <mesh castShadow position={[0, -height/(2*scale) + 2, 0]}>
                <cylinderGeometry args={[0.3, 0.5, 4, 8]} />
                <meshStandardMaterial color="#3f2a14" />
              </mesh>
              <mesh castShadow position={[0, -height/(2*scale) + 5, 0]}>
                <coneGeometry args={[2, 4, 8]} />
                <meshStandardMaterial color="#14532d" />
              </mesh>
            </group>
          ) : (
            <mesh castShadow>
              <dodecahedronGeometry args={[2]} />
              <meshStandardMaterial color="#374151" roughness={1} />
            </mesh>
          )
        )}

        {theme === 'Snow' && (
          type === 'spike' ? (
            <mesh castShadow>
              <coneGeometry args={[1, 6, 4]} />
              <meshStandardMaterial color="#93c5fd" transparent opacity={0.8} metalness={1} roughness={0} />
            </mesh>
          ) : (
            <mesh castShadow>
              <sphereGeometry args={[2, 16, 16]} />
              <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
            </mesh>
          )
        )}

        {theme === 'City' && (
          type === 'building' ? (
            <mesh castShadow>
              <boxGeometry args={[4, height/scale, 4]} />
              <meshStandardMaterial color="#1e293b" />
              {/* Windows */}
              {[...Array(4)].map((_, i) => (
                <mesh key={i} position={[0, (i - 1.5) * 3, 2.01]}>
                  <planeGeometry args={[3, 1]} />
                  <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={Math.random() > 0.5 ? 2 : 0.2} />
                </mesh>
              ))}
            </mesh>
          ) : type === 'car' ? (
            <group position={[0, -height/(2*scale) + 1, 0]}>
              <mesh castShadow position={[0, 0.5, 0]}>
                <boxGeometry args={[2, 1, 4]} />
                <meshStandardMaterial color={Math.random() > 0.5 ? "#ef4444" : "#3b82f6"} />
              </mesh>
              <mesh castShadow position={[0, 1.5, -0.5]}>
                <boxGeometry args={[1.8, 1, 2]} />
                <meshStandardMaterial color="#94a3b8" />
              </mesh>
            </group>
          ) : (
            <mesh castShadow position={[0, -height/(2*scale) + 1, 0]}>
              <boxGeometry args={[2, 2, 1.5]} />
              <meshStandardMaterial color="#166534" />
            </mesh>
          )
        )}

        {theme === 'Cyber' && (
          type === 'server' ? (
            <mesh castShadow>
              <boxGeometry args={[2, height/scale, 2]} />
              <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
              {[...Array(5)].map((_, i) => (
                <mesh key={i} position={[0, (i - 2) * 1.5, 1.01]}>
                  <planeGeometry args={[1.5, 0.2]} />
                  <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={Math.random() > 0.5 ? 2 : 0} />
                </mesh>
              ))}
            </mesh>
          ) : type === 'dataPillar' ? (
            <mesh castShadow>
              <cylinderGeometry args={[1, 1, height/scale, 8]} />
              <meshStandardMaterial color="#000" metalness={1} roughness={0.1} />
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[1.1, 1.1, height/scale * 0.8, 8]} />
                <meshStandardMaterial color="#ff00ff" wireframe emissive="#ff00ff" emissiveIntensity={2} />
              </mesh>
            </mesh>
          ) : (
            <Float speed={3} rotationIntensity={0.2} floatIntensity={0.5}>
               <mesh position={[0, height/(2*scale), 0]}>
                 <planeGeometry args={[4, 2]} />
                 <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} side={THREE.DoubleSide} transparent opacity={0.8} />
               </mesh>
            </Float>
          )
        )}
      </group>
    </RigidBody>
  );
};

const OuterWalls = ({ size, theme }: { size: number, theme: string }) => {
  const halfSize = size / 2;
  const wallHeight = 20;
  
  const wallTexture = useMemo(() => {
    if (theme === 'Cyber') return createGridTexture('#000000', '#ff00ff', size / 10);
    if (theme === 'City') return createCheckerTexture('#1e293b', '#334155', size / 5);
    return null;
  }, [theme, size]);

  const WallMesh = ({ args, position, rotation }: any) => (
    <RigidBody type="fixed" colliders="cuboid" position={position} rotation={rotation}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={args} />
        {theme === 'Cyber' ? (
          <meshStandardMaterial map={wallTexture || undefined} metalness={0.8} roughness={0.2} emissive="#ff00ff" emissiveIntensity={0.2} />
        ) : theme === 'Jungle' ? (
          <meshStandardMaterial color="#2d4a22" roughness={1} />
        ) : theme === 'Snow' ? (
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.8} />
        ) : (
          <meshStandardMaterial map={wallTexture || undefined} />
        )}
      </mesh>
      {theme === 'Cyber' && (
        <mesh position={[0, wallHeight / 2 - 0.1, 0]}>
          <boxGeometry args={[args[0] + 0.1, 0.5, args[2] + 0.1]} />
          <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={5} toneMapped={false} />
        </mesh>
      )}
    </RigidBody>
  );

  return (
    <group>
      {/* Edge Walls */}
      <WallMesh position={[0, wallHeight / 2, -halfSize]} args={[size + 4, wallHeight, 2]} />
      <WallMesh position={[0, wallHeight / 2, halfSize]} args={[size + 4, wallHeight, 2]} />
      <WallMesh position={[-halfSize, wallHeight / 2, 0]} args={[2, wallHeight, size + 4]} />
      <WallMesh position={[halfSize, wallHeight / 2, 0]} args={[2, wallHeight, size + 4]} />
      {/* Corner Guard Rails - seal all 4 corners */}
      <WallMesh position={[-halfSize, wallHeight / 2, -halfSize]} args={[4, wallHeight, 4]} />
      <WallMesh position={[halfSize, wallHeight / 2, -halfSize]} args={[4, wallHeight, 4]} />
      <WallMesh position={[-halfSize, wallHeight / 2, halfSize]} args={[4, wallHeight, 4]} />
      <WallMesh position={[halfSize, wallHeight / 2, halfSize]} args={[4, wallHeight, 4]} />
    </group>
  );
};

const StreetLights = ({ size, seed }: { size: number, seed: number }) => {
  const lights = useMemo(() => {
    const l = [];
    let s = seed;
    for (let i = 0; i < 8; i++) {
      l.push({
        position: [(Math.sin(s++) * 0.45) * size, 0, (Math.cos(s++) * 0.45) * size] as [number, number, number]
      });
    }
    return l;
  }, [size, seed]);

  return (
    <group>
      {lights.map((l, i) => (
        <group key={i} position={l.position}>
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 8]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, 8, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 1]} />
            <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={10} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 7.5, 1]} intensity={10} color="#facc15" distance={20} />
        </group>
      ))}
    </group>
  );
};

const SwampMist = ({ size }: { size: number }) => {
  return (
    <group>
      {[...Array(5)].map((_, i) => (
        <Float key={i} speed={1} rotationIntensity={2} floatIntensity={2}>
          <mesh position={[(Math.random() - 0.5) * size, 2, (Math.random() - 0.5) * size]}>
            <sphereGeometry args={[5, 16, 16]} />
            <meshStandardMaterial color="#4ade80" transparent opacity={0.1} depthWrite={false} />
          </mesh>
        </Float>
      ))}
    </group>
  );
};

const TowerBase: React.FC<{ team: any, theme: string }> = ({ team, theme }) => {
  const [x, y, z] = team.basePosition;
  
  return (
    <group position={[x, y, z]}>
      {/* Base Platform */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
         <mesh receiveShadow>
           <boxGeometry args={[18, 1, 18]} />
           <meshStandardMaterial color={team.color} transparent opacity={0.2} metalness={0.8} />
         </mesh>
      </RigidBody>

      {/* Awesome Tower Structure */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 4, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[2, 4, 10, 8]} />
          <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.2} wireframe={theme === 'Cyber'} />
        </mesh>
      </RigidBody>
      
      {/* Floating Rotating Energy Rings */}
      <Float speed={2} rotationIntensity={2} floatIntensity={0.5}>
         <mesh position={[0, 8, 0]}>
           <torusGeometry args={[5, 0.2, 16, 32]} />
           <meshStandardMaterial color={team.color} emissive={team.color} emissiveIntensity={2} />
         </mesh>
      </Float>
      <Float speed={3} rotationIntensity={3} floatIntensity={0.5}>
         <mesh position={[0, 6, 0]}>
           <torusGeometry args={[3.5, 0.1, 16, 32]} />
           <meshStandardMaterial color={team.color} emissive={team.color} emissiveIntensity={1.5} />
         </mesh>
      </Float>

      {/* The Beacon / Light */}
      <Float speed={4} rotationIntensity={1} floatIntensity={1}>
        <mesh position={[0, 12, 0]} castShadow>
          <octahedronGeometry args={[2]} />
          <meshStandardMaterial color={team.color} emissive={team.color} emissiveIntensity={4} />
        </mesh>
      </Float>
      <pointLight position={[0, 12, 0]} intensity={10} color={team.color} distance={40} />

      {/* Healing/Spawn Area Indicator */}
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[12, 12, 10, 32, 1, true]} />
        <meshStandardMaterial color={team.color} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
};
