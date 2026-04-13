import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, InstancedRigidBodies } from '@react-three/rapier';
import { Grid, Float, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore, MapDesign } from '../store';

// ─── Texture Helpers ───────────────────────────────────────────

const texPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

const useMapMaterials = (floorUrl: string, wallUrl: string, repeatSize: number) => {
  const [floorTex, wallTex] = useTexture([texPath(floorUrl), texPath(wallUrl)]);
  
  useMemo(() => {
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(repeatSize / 10, repeatSize / 10);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.needsUpdate = true;
    
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(repeatSize / 20, repeatSize / 20); // Arbitrary scale factor for walls
    wallTex.colorSpace = THREE.SRGBColorSpace;
    wallTex.needsUpdate = true;
  }, [floorTex, wallTex, repeatSize]);

  return { 
    floor: <meshStandardMaterial map={floorTex} roughness={0.8} metalness={0.2} />,
    wall: <meshStandardMaterial map={wallTex} roughness={0.7} metalness={0.3} />
  };
};

const useSingleTextureMaterial = (url: string, repeat = 1, metalness = 0.5, roughness = 0.5) => {
  const tex = useTexture(texPath(url));
  useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }, [tex, repeat]);
  return <meshStandardMaterial map={tex} roughness={roughness} metalness={metalness} />;
};

// ─── Kinetic Props ──────────────────────────────────────────────

const KineticTurbine = ({ position, rotationSpeed = 1, axis = 'y', scale = 1, texUrl }: { position: [number,number,number], rotationSpeed?: number, axis?: 'x'|'y'|'z', scale?: number, texUrl?: string }) => {
  const ref = useRef<RapierRigidBody>(null);
  const material = texUrl ? useSingleTextureMaterial(texUrl, 2, 0.8, 0.3) : <meshStandardMaterial color="#334155" metalness={0.8} />;
  
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
        {material}
      </mesh>
      <mesh castShadow receiveShadow rotation={[0, Math.PI/2, 0]}>
        <boxGeometry args={[16 * scale, 1 * scale, 2 * scale]} />
        {material}
      </mesh>
    </RigidBody>
  );
};

// ─── Map Designs ───────────────────────────────────────────────

const ThePit = ({ size }: { size: number }) => {
  const s = size / 2;
  const mats = useMapMaterials('/textures/floor_pit.png', '/textures/wall_pit.png', size);
  const baseFloorMat = useSingleTextureMaterial('/textures/floor_base2.png', size/10);
  const rampAng = 0.35; 
  const pDrop = -8; 
  
  return (
    <group>
      {/* Outer Elevated Ring (Y=0 top) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, -2, -s + 6]} receiveShadow><boxGeometry args={[size, 4, 12]} />{mats.floor}</mesh>
        <mesh position={[0, -2, s - 6]} receiveShadow><boxGeometry args={[size, 4, 12]} />{mats.floor}</mesh>
        <mesh position={[-s + 6, -2, 0]} receiveShadow><boxGeometry args={[12, 4, size - 24]} />{mats.floor}</mesh>
        <mesh position={[s - 6, -2, 0]} receiveShadow><boxGeometry args={[12, 4, size - 24]} />{mats.floor}</mesh>
        {/* Corner Base Pads */}
        {[[-1,-1], [1,-1], [-1,1], [1,1]].map(([x,z], i) => (
           <mesh key={i} position={[x * (s-10), -0.5, z * (s-10)]} receiveShadow>
             <boxGeometry args={[20, 1, 20]} />{baseFloorMat}
           </mesh>
        ))}
      </RigidBody>
      
      <group>
      {/* Ramps down to center pit */}
      <RigidBody type="fixed" colliders="cuboid" rotation={[rampAng, 0, 0]} position={[0, pDrop/2 - 0.5, -s + 18]}>
        <mesh receiveShadow><boxGeometry args={[16, 1, 24]} />{mats.wall}</mesh>
      </RigidBody>
      {/* Under-ramp pillars */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, pDrop/2 - 2, -s + 20]}>
        <mesh receiveShadow><boxGeometry args={[14, Math.abs(pDrop), 4]} />{mats.wall}</mesh>
      </RigidBody>
      
      <RigidBody type="fixed" colliders="cuboid" rotation={[-rampAng, 0, 0]} position={[0, pDrop/2 - 0.5, s - 18]}>
        <mesh receiveShadow><boxGeometry args={[16, 1, 24]} />{mats.wall}</mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" position={[0, pDrop/2 - 2, s - 20]}>
        <mesh receiveShadow><boxGeometry args={[14, Math.abs(pDrop), 4]} />{mats.wall}</mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, -rampAng]} position={[-s + 18, pDrop/2 - 0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[24, 1, 16]} />{mats.wall}</mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, rampAng]} position={[s - 18, pDrop/2 - 0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[24, 1, 16]} />{mats.wall}</mesh>
      </RigidBody>
      </group>

      {/* Central Cover Structure */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, pDrop + 4, 0]}>
         <mesh receiveShadow castShadow><boxGeometry args={[10, 8, 10]} />{mats.wall}</mesh>
      </RigidBody>
    </group>
  );
};

const Crossfire = ({ size }: { size: number }) => {
  const hs = size / 2;
  const mats = useMapMaterials('/textures/floor_crossfire.png', '/textures/wall_crossfire.png', size);
  const bridgeMat = useSingleTextureMaterial('/textures/wall_poly_2.jpg', size/15, 0.5, 0.8);
  
  return (
    <group>
      {/* Corner Islands (Y=0) */}
      <RigidBody type="fixed" colliders="cuboid">
      {[[-1,-1], [-1,1], [1,-1], [1,1]].map(([x,z], i) => (
          <mesh key={i} receiveShadow castShadow position={[x * hs * 0.65, -10, z * hs * 0.65]}>
              <boxGeometry args={[24, 20, 24]} />{mats.floor}
          </mesh>
      ))}
      </RigidBody>

      {/* Connecting crossing bridges */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[size * 0.8, 1, 8]} />{bridgeMat}</mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[8, 1, size * 0.8]} />{bridgeMat}</mesh>
      </RigidBody>

      {/* Center Platform */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 0, 0]}>
        <mesh receiveShadow><cylinderGeometry args={[12, 12, 2, 16]} />{mats.wall}</mesh>
      </RigidBody>

      {/* Kinetic Turbines */}
      <KineticTurbine position={[0, -4, 0]} rotationSpeed={2} scale={1.5} texUrl="/textures/obj_2.jpg" />
      <KineticTurbine position={[-15, -0.5, 0]} rotationSpeed={1.5} axis="x" scale={0.7} texUrl="/textures/obj_2.jpg" />
      <KineticTurbine position={[15, -0.5, 0]} rotationSpeed={1.5} axis="x" scale={0.7} texUrl="/textures/obj_2.jpg" />
    </group>
  );
};

const Highrise = ({ size }: { size: number }) => {
  const hs = size / 2;
  const mats = useMapMaterials('/textures/floor_highrise.png', '/textures/wall_highrise.png', size);
  const rampMat = useSingleTextureMaterial('/textures/floor_base1.png', 4, 0.4, 0.6);
  
  return (
    <group>
      {/* Base Level (Y=0) */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[size, 1, size]} />{mats.floor}</mesh>
      </RigidBody>

      {/* Tower Tier 1 */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 4, 0]}>
        <mesh receiveShadow castShadow><boxGeometry args={[size * 0.6, 8, size * 0.6]} />{mats.wall}</mesh>
      </RigidBody>
      {/* Tier 1 Cover */}
      {[[-1,-1], [1,-1], [-1,1], [1,1]].map(([x,z], i) => (
         <RigidBody key={i} type="fixed" colliders="cuboid" position={[x * hs * 0.5, 10, z * hs * 0.5]}>
            <mesh receiveShadow castShadow><boxGeometry args={[4, 4, 4]} />{rampMat}</mesh>
         </RigidBody>
      ))}

      {/* Tower Tier 2 */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 12, 0]}>
        <mesh receiveShadow castShadow><boxGeometry args={[size * 0.3, 8, size * 0.3]} />{mats.wall}</mesh>
      </RigidBody>

      {/* Ramps */}
      <RigidBody type="fixed" colliders="cuboid" rotation={[0.4, 0, 0]} position={[0, 4, hs * 0.6 + 2]}>
        <mesh receiveShadow><boxGeometry args={[12, 1, 20]} />{rampMat}</mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[-0.4, 0, 0]} position={[0, 4, -hs * 0.6 - 2]}>
        <mesh receiveShadow><boxGeometry args={[12, 1, 20]} />{rampMat}</mesh>
      </RigidBody>
      
      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, 0.4]} position={[hs * 0.3 + 2, 12, 0]}>
        <mesh receiveShadow><boxGeometry args={[20, 1, 8]} />{rampMat}</mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, -0.4]} position={[-hs * 0.3 - 2, 12, 0]}>
        <mesh receiveShadow><boxGeometry args={[20, 1, 8]} />{rampMat}</mesh>
      </RigidBody>
    </group>
  );
};

const Fortress = ({ size }: { size: number }) => {
  const hs = size / 2;
  const mats = useMapMaterials('/textures/floor_fortress.png', '/textures/wall_fortress.png', size);
  const obeliskMat = useSingleTextureMaterial('/textures/wall_poly_3.jpg', 3, 0.1, 0.9);
  
  return (
    <group>
      {/* Ground (Y=0) */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[size, 1, size]} />{mats.floor}</mesh>
      </RigidBody>

      {/* Massive walls forming courtyards */}
      <RigidBody type="fixed" colliders="cuboid">
        {/* Central Cross Walls */}
        <mesh position={[0, 6, 0]} receiveShadow castShadow><boxGeometry args={[size * 0.6, 12, 4]} />{mats.wall}</mesh>
        <mesh position={[0, 6, 0]} receiveShadow castShadow><boxGeometry args={[4, 12, size * 0.6]} />{mats.wall}</mesh>
        
        {/* Courtyard Outer Corners */}
        {[[-1,-1], [-1,1], [1,-1], [1,1]].map(([x,z], i) => (
            <group key={i}>
                <mesh position={[x * hs * 0.8, 6, z * hs * 0.4]} receiveShadow castShadow><boxGeometry args={[4, 12, size * 0.2]} />{mats.wall}</mesh>
                <mesh position={[x * hs * 0.4, 6, z * hs * 0.8]} receiveShadow castShadow><boxGeometry args={[size * 0.2, 12, 4]} />{mats.wall}</mesh>
            </group>
        ))}

        {/* Center Obelisk */}
        <mesh position={[0, 12, 0]} receiveShadow castShadow><cylinderGeometry args={[2, 4, 24, 4]} />{obeliskMat}</mesh>
      </RigidBody>
    </group>
  );
};

const Orbital = ({ size }: { size: number }) => {
  const hs = size / 2;
  const mats = useMapMaterials('/textures/floor_orbital.png', '/textures/wall_orbital.png', size);
  const baseFloor = useSingleTextureMaterial('/textures/floor_underground.png', size/8, 0.8, 0.2);

  // For animated orbital bridge
  const bridgeTex = useTexture(texPath('/textures/wall_tech.png'));
  useMemo(() => { bridgeTex.wrapS = bridgeTex.wrapT = THREE.RepeatWrapping; bridgeTex.needsUpdate = true; }, [bridgeTex]);
  useFrame((state) => { bridgeTex.offset.y = -(state.clock.elapsedTime * 0.2) % 1; });

  return (
    <group>
      {/* Base Level platforms */}
      <RigidBody type="fixed" colliders="cuboid">
        {[[-1,-1], [1,-1], [-1,1], [1,1]].map(([x,z], i) => (
          <mesh key={i} receiveShadow position={[x * hs * 0.8, -0.5, z * hs * 0.8]}>
            <boxGeometry args={[16, 1, 16]} />
            {baseFloor}
          </mesh>
        ))}
      </RigidBody>

      {/* Flowing energy bridges */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow><boxGeometry args={[size * 0.9, 1, 6]} /><meshStandardMaterial map={bridgeTex} /></mesh>
        <mesh receiveShadow><boxGeometry args={[6, 1, size * 0.9]} /><meshStandardMaterial map={bridgeTex} /></mesh>
      </RigidBody>

      {/* Massive Gyroscope Rings */}
      <KineticTurbine position={[0, 15, 0]} rotationSpeed={0.5} axis="x" scale={1.2} texUrl="/textures/wall_poly_1.jpg" />
      <KineticTurbine position={[0, 15, 0]} rotationSpeed={-0.6} axis="z" scale={1.4} texUrl="/textures/wall_poly_1.jpg" />
    </group>
  );
};

const Volcano = ({ size }: { size: number }) => {
  const hs = size / 2;
  const mats = useMapMaterials('/textures/floor_volcano.png', '/textures/wall_volcano.png', size);
  const bridgeMat = useSingleTextureMaterial('/textures/wall_poly_3.jpg', size/10, 0.1, 0.9);

  // Animated Lava
  const lavaTex = useTexture(texPath('/textures/floor_volcano.png'));
  useMemo(() => { lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping; lavaTex.repeat.set(size/10, size/10); lavaTex.colorSpace = THREE.SRGBColorSpace; lavaTex.needsUpdate = true; }, [lavaTex, size]);
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
            {mats.floor}
          </mesh>
        ))}
      </RigidBody>

      {/* The Central Peak */}
      <RigidBody type="fixed" colliders="hull" position={[0, -2, 0]}>
        <mesh receiveShadow castShadow>
          <coneGeometry args={[20, 20, 6]} />
          {mats.wall}
        </mesh>
      </RigidBody>

      {/* Bridges to Peak */}
      <RigidBody type="fixed" colliders="cuboid" rotation={[0.2, 0, 0]} position={[0, 2, hs * 0.5]}>
        <mesh receiveShadow><boxGeometry args={[8, 1, hs*0.8]} />{bridgeMat}</mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[-0.2, 0, 0]} position={[0, 2, -hs * 0.5]}>
        <mesh receiveShadow><boxGeometry args={[8, 1, hs*0.8]} />{bridgeMat}</mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, -0.2]} position={[hs * 0.5, 2, 0]}>
        <mesh receiveShadow><boxGeometry args={[hs*0.8, 1, 8]} />{bridgeMat}</mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" rotation={[0, 0, 0.2]} position={[-hs * 0.5, 2, 0]}>
        <mesh receiveShadow><boxGeometry args={[hs*0.8, 1, 8]} />{bridgeMat}</mesh>
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
  
  // Decide which object texture to use based on map theme
  let objTexUrl = '/textures/obj_1.jpg'; // metal grate rusty
  if (theme === 'Crossfire') objTexUrl = '/textures/obj_2.jpg';
  if (theme === 'Fortress') objTexUrl = '/textures/obj_3.jpg';
  if (theme === 'Highrise') objTexUrl = '/textures/wall_poly_1.jpg'; // blue metal plate
  if (theme === 'Orbital') objTexUrl = '/textures/wall_poly_2.jpg'; // brick? no let's use base
  if (theme === 'Volcano') objTexUrl = '/textures/floor_arena.png';
  
  const objTex = useTexture(texPath(objTexUrl));
  useMemo(() => {
    objTex.wrapS = objTex.wrapT = THREE.RepeatWrapping;
    objTex.repeat.set(1, 1);
    objTex.colorSpace = THREE.SRGBColorSpace;
    objTex.needsUpdate = true;
  }, [objTex]);

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
        
        let nearBase = false;
        teams.forEach(team => {
          const [bx, by, bz] = team.basePosition;
          if (Math.abs(x - bx) < 15 && Math.abs(z - bz) < 15) nearBase = true;
        });
        if (nearBase) continue;

        if (theme === 'The Pit' && Math.sqrt(x*x + z*z) > size*0.35) continue;
        if (theme === 'Crossfire' && Math.abs(x) > 6 && Math.abs(z) > 6) continue;
        if (theme === 'Volcano' && Math.sqrt(x*x + z*z) < 22) continue;
        if (theme === 'Orbital' && Math.abs(x) > 8 && Math.abs(z) > 8) continue;
        
        if (random() > (1 - density)) {
          obs.push({
            position: [x + (random() - 0.5) * 4, 10, z + (random() - 0.5) * 4] as [number, number, number],
            scale: [3 * (0.8 + random() * 1.5), 3 * (0.8 + random() * 1.5), 3 * (0.8 + random() * 1.5)] as [number, number, number],
            rotation: [0, random() * Math.PI, 0] as [number, number, number]
          });
        }
      }
    }
    return obs;
  }, [mapConfig, teams, halfSize, density, size, theme]);

  if (obstacles.length === 0) return null;

  const positions = new Float32Array(obstacles.length * 3);
  const rotations = new Float32Array(obstacles.length * 4);
  const scales = new Float32Array(obstacles.length * 3);

  obstacles.forEach((obs, i) => {
    positions[i * 3 + 0] = obs.position[0];
    positions[i * 3 + 1] = obs.position[1];
    positions[i * 3 + 2] = obs.position[2];

    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(obs.rotation[0], obs.rotation[1], obs.rotation[2]));
    rotations[i * 4 + 0] = q.x;
    rotations[i * 4 + 1] = q.y;
    rotations[i * 4 + 2] = q.z;
    rotations[i * 4 + 3] = q.w;

    scales[i * 3 + 0] = obs.scale[0];
    scales[i * 3 + 1] = obs.scale[1];
    scales[i * 3 + 2] = obs.scale[2];
  });

  return (
    <InstancedRigidBodies
      positions={positions}
      rotations={rotations}
      scales={scales}
      colliders="cuboid"
    >
      <instancedMesh args={[undefined, undefined, obstacles.length]} castShadow={false} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={objTex} roughness={0.8} metalness={0.2} />
      </instancedMesh>
    </InstancedRigidBodies>
  );
};

// ─── Blades Of Death Hazard ─────────────────────────────────────
const BladesOfDeath = ({ size }: { size: number }) => {
  const bladesRef = useRef<THREE.InstancedMesh>(null);
  const shaderMatRef = useRef<THREE.MeshStandardMaterial>(null);
  
  useEffect(() => {
    if (shaderMatRef.current) {
        shaderMatRef.current.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = { value: 0 };
            shaderMatRef.current.userData.shader = shader;
            shader.vertexShader = `
              uniform float uTime;
              ${shader.vertexShader}
            `.replace(
              `#include <begin_vertex>`,
              `
              #include <begin_vertex>
              float dir = mod(instanceMatrix[3][0] + instanceMatrix[3][2], 2.0) > 1.0 ? 1.0 : -1.0;
              float angle = uTime * 15.0 * dir;
              
              float s = sin(angle);
              float c = cos(angle);
              mat3 rotMat = mat3(
                c, 0.0, s,
                0.0, 1.0, 0.0,
                -s, 0.0, c
              );
              transformed = rotMat * transformed;
              `
            );
        };
    }
  }, []);
  
  useEffect(() => {
      if (bladesRef.current) {
          let index = 0;
          const bladesDummy = new THREE.Object3D();
          for (let x = -size*1.5; x <= size*1.5; x += 15) {
            for (let z = -size*1.5; z <= size*1.5; z += 15) {
              bladesDummy.position.set(x, 0, z);
              bladesDummy.scale.set(8, 0.4, 8);
              bladesDummy.updateMatrix();
              if (index < bladesRef.current.count) {
                  bladesRef.current.setMatrixAt(index++, bladesDummy.matrix);
              }
            }
          }
          bladesRef.current.instanceMatrix.needsUpdate = true;
      }
  }, [size]);

  useFrame((state) => {
    if (shaderMatRef.current && shaderMatRef.current.userData.shader) {
        shaderMatRef.current.userData.shader.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group position={[0, -15, 0]}>
      <RigidBody type="fixed" colliders="cuboid" position={[0, -5, 0]}>
        <mesh>
          <boxGeometry args={[size * 4, 10, size * 4]} />
          <meshBasicMaterial color="#2d0a0a" />
        </mesh>
      </RigidBody>
      
      <instancedMesh ref={bladesRef} args={[undefined, undefined, 400]} castShadow={false} receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial ref={shaderMatRef} color="#334155" metalness={1} roughness={0.2} emissive="#991b1b" emissiveIntensity={0.5} />
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

      {/* Map Specific Fog/Grid */}
      {theme === 'Highrise' && (
        <Grid infiniteGrid fadeDistance={size} sectionColor="#38bdf8" cellColor="#0ea5e9" position={[0, -0.4, 0]} />
      )}

      {theme !== 'Volcano' && <BladesOfDeath size={size} />}

      <MapObstacles mapConfig={mapConfig} teams={teams} />

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

      <Float speed={4} rotationIntensity={1} floatIntensity={1}>
        <mesh position={[0, 10, 0]} castShadow>
          <octahedronGeometry args={[1.5]} />
          <meshStandardMaterial color={team.color} emissive={team.color} emissiveIntensity={4} />
        </mesh>
      </Float>
      <pointLight position={[0, 10, 0]} intensity={10} color={team.color} distance={40} />

      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[10, 10, 8, 32, 1, true]} />
        <meshStandardMaterial color={team.color} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
};
