import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';

const DUST_LIFETIME = 1.0;
const IMPACT_LIFETIME = 0.5;

interface ParticleProps {
  id: string;
  type: 'impact' | 'dust';
  position: [number, number, number];
  color: string;
  time: number;
}

const ImpactEffect: React.FC<ParticleProps> = ({ id, position, color, time, type }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    return Array.from({ length: type === 'impact' ? 20 : 5 }).map(() => ({
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * (type === 'impact' ? 10 : 2),
        Math.random() * (type === 'impact' ? 10 : 2) + (type === 'impact' ? 5 : 1),
        (Math.random() - 0.5) * (type === 'impact' ? 10 : 2)
      ),
      scale: Math.random() * 0.5 + 0.2
    }));
  }, [type]);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: type === 'impact' ? 3.0 : 0.2,
    transparent: true,
    opacity: 1
  }), [color, type]);

  useFrame(() => {
    if (!meshRef.current) return;
    
    const now = performance.now();
    const age = (now - time) / 1000;
    const lifetime = type === 'impact' ? IMPACT_LIFETIME : DUST_LIFETIME;
    
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
        </group>
      ))}
    </group>
  );
};
