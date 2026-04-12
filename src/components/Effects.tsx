import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';

const DUST_LIFETIME = 1.0;
const IMPACT_LIFETIME = 0.5;

interface ParticleProps {
  id: string;
  type: 'impact' | 'dust' | 'blood_explosion';
  position: [number, number, number];
  color: string;
  time: number;
}

const ImpactEffect: React.FC<ParticleProps> = ({ id, position, color, time, type }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    let count = 5;
    if (type === 'impact') count = 20;
    if (type === 'blood_explosion') count = 100;
    
    return Array.from({ length: count }).map(() => ({
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * (type === 'blood_explosion' ? 30 : type === 'impact' ? 10 : 2),
        Math.random() * (type === 'blood_explosion' ? 25 : type === 'impact' ? 10 : 2) + (type === 'blood_explosion' ? 10 : type === 'impact' ? 5 : 1),
        (Math.random() - 0.5) * (type === 'blood_explosion' ? 30 : type === 'impact' ? 10 : 2)
      ),
      scale: Math.random() * (type === 'blood_explosion' ? 1.0 : 0.5) + (type === 'blood_explosion' ? 0.3 : 0.2)
    }));
  }, [type]);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: type === 'blood_explosion' ? 0.5 : type === 'impact' ? 3.0 : 0.2,
    transparent: true,
    opacity: 1
  }), [color, type]);

  useFrame(() => {
    if (!meshRef.current) return;
    
    const now = performance.now();
    const age = (now - time) / 1000;
    const lifetime = type === 'blood_explosion' ? 2.0 : type === 'impact' ? IMPACT_LIFETIME : DUST_LIFETIME;
    
    if (age > lifetime) {
      useGameStore.getState().removeEffect(id);
      return;
    }

    const progress = age / lifetime;
    mat.opacity = 1.0 - Math.pow(progress, 2);

    particles.forEach((p, i) => {
      // Simulate gravity and drag
      p.velocity.y -= 15 * 0.016; 
      p.position.addScaledVector(p.velocity, 0.016);
      
      dummy.position.copy(p.position).add(new THREE.Vector3(...position));
      
      const s = p.scale * (1.0 - progress);
      dummy.scale.set(s, s, s);
      
      dummy.rotation.x += p.velocity.x * 0.016;
      dummy.rotation.y += p.velocity.y * 0.016;
      
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, mat, particles.length]} castShadow />
  );
};

export const Effects: React.FC = () => {
  const effects = useGameStore(state => state.effects);
  
  const impactGeo = useMemo(() => new THREE.BoxGeometry(0.2, 0.2, 0.2), []);
  const dustGeo = useMemo(() => new THREE.SphereGeometry(0.3, 4, 4), []);
  const bloodGeo = useMemo(() => new THREE.DodecahedronGeometry(0.3, 0), []);

  return (
    <group>
      {effects.map(effect => (
        <group key={effect.id}>
          {effect.type === 'impact' && (
            <ImpactEffect {...effect} />
          )}
          {effect.type === 'dust' && (
            <ImpactEffect {...effect} />
          )}
          {effect.type === 'blood_explosion' && (
            <group>
               <ImpactEffect {...effect} />
               <BloodMist position={effect.position} time={effect.time} color={effect.color} />
            </group>
          )}
        </group>
      ))}
    </group>
  );
};

const BloodMist: React.FC<{position: [number,number,number], time: number, color: string}> = ({position, time, color}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
     if (!meshRef.current) return;
     const age = (performance.now() - time) / 1000;
     if (age > 2.0) return;
     const p = age / 2.0;
     const s = 1.0 + p * 15.0; // Expand to 15x size
     meshRef.current.scale.set(s,s,s);
     (meshRef.current.material as THREE.MeshBasicMaterial).opacity = (1.0 - p) * 0.6;
  });

  return (
    <mesh ref={meshRef} position={position}>
       <sphereGeometry args={[1, 16, 16]} />
       <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
    </mesh>
  );
};
