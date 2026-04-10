import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, PeerData } from '../store';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

export const Peers: React.FC = () => {
  const peers = useGameStore((state) => state.peers);

  return (
    <group>
      {Object.values(peers).map((peer) => (
        <Peer key={peer.id} data={peer} />
      ))}
    </group>
  );
};

const Peer: React.FC<{ data: PeerData }> = ({ data }) => {
  const groupRef = useRef<THREE.Group>(null);
  const chainInstancedMesh = useRef<THREE.InstancedMesh>(null);
  const { chainLink, teams } = useGameStore();

  const teamColor = useMemo(() => teams.find(t => t.id === data.teamId)?.color || '#94a3b8', [teams, data.teamId]);

  const chainGeo = useMemo(() => {
    if (chainLink === 'box') return new THREE.BoxGeometry(0.2, 0.1, 0.4);
    if (chainLink === 'cylinder') return new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
    return new THREE.TorusGeometry(0.15, 0.06, 8, 16);
  }, [chainLink]);

  const [chainMat] = useState(() => new THREE.MeshStandardMaterial({ 
    color: '#e2e8f0', 
    metalness: 1, 
    roughness: 0.2,
    emissive: '#0ea5e9',
    emissiveIntensity: 0.8
  }));

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (data.status === 'dead') {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    // Smooth Lerp Position and Rotation
    const targetPos = new THREE.Vector3(...data.position);
    const targetQuat = new THREE.Quaternion(...data.rotation);
    
    groupRef.current.position.lerp(targetPos, 10 * delta);
    groupRef.current.quaternion.slerp(targetQuat, 10 * delta);

    // Chain Rendering
    if (chainInstancedMesh.current && data.hookStatus !== 'idle' && data.hookPos) {
      const pPos = new THREE.Vector3(groupRef.current.position.x, groupRef.current.position.y + 1, groupRef.current.position.z);
      const hPos = new THREE.Vector3(...data.hookPos);
      const dist = pPos.distanceTo(hPos);
      
      const linkLength = chainLink === 'box' ? 0.4 : chainLink === 'cylinder' ? 0.4 : 0.4;
      const numLinks = Math.min(150, Math.floor(dist / linkLength));
      chainInstancedMesh.current.count = numLinks;
      
      const dummy = new THREE.Object3D();
      const up = new THREE.Vector3(0, 1, 0);
      const midPoint = new THREE.Vector3().addVectors(pPos, hPos).multiplyScalar(0.5);
      const droopAmount = data.hookStatus === 'retracting' ? 0.2 : Math.min(dist * 0.2, 2.0);
      midPoint.y -= droopAmount;
      
      const curve = new THREE.QuadraticBezierCurve3(pPos, midPoint, hPos);

      for (let i = 0; i < numLinks; i++) {
        const t = i / (numLinks - 1 || 1);
        const pos = curve.getPoint(t);
        const tangent = curve.getTangent(t);

        dummy.position.copy(pos);
        const axis = new THREE.Vector3().crossVectors(up, tangent).normalize();
        const radians = Math.acos(Math.max(-1, Math.min(1, up.dot(tangent))));
        dummy.quaternion.setFromAxisAngle(axis, radians);
        dummy.rotateX(Math.PI / 2);
        if (i % 2 === 0) dummy.rotateY(Math.PI / 2);
        
        dummy.updateMatrix();
        chainInstancedMesh.current.setMatrixAt(i, dummy.matrix);
      }
      chainInstancedMesh.current.instanceMatrix.needsUpdate = true;
    } else if (chainInstancedMesh.current) {
      chainInstancedMesh.current.count = 0;
    }
  });

  return (
    <>
      <group ref={groupRef}>
        <mesh castShadow position={[0, 1, 0]}>
          <capsuleGeometry args={[0.5, 1, 16]} />
          <meshStandardMaterial color={teamColor} emissive={teamColor} emissiveIntensity={0.2} roughness={0.2} metalness={0.8} />
        </mesh>
        <mesh position={[0, 1.5, 0.4]}>
          <boxGeometry args={[0.6, 0.2, 0.3]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} toneMapped={false} />
        </mesh>
        
        <Html position={[0, 2.5, 0]} center transform sprite>
          <div className="flex flex-col items-center pointer-events-none">
            <div className="text-xs font-bold text-white drop-shadow-md mb-1">{data.id.substring(0, 4)}</div>
          </div>
        </Html>
      </group>

      {/* Render Hook Tip */}
      {data.hookStatus !== 'idle' && data.hookPos && (
        <mesh castShadow position={data.hookPos}>
           <cylinderGeometry args={[0.3, 0.3, 0.15, 16]} />
           <meshStandardMaterial metalness={1} roughness={0.05} color="#ffffff" />
        </mesh>
      )}

      {/* Render Chain */}
      <instancedMesh ref={chainInstancedMesh} args={[chainGeo, chainMat, 150]} castShadow frustumCulled={false} />
    </>
  );
};
