import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type CharacterActionState = 'idle' | 'walk' | 'jump' | 'doubleJump' | 'fall' | 'land' | 'shoot' | 'hit' | 'hooked' | 'dead';

interface CharacterModelProps {
  actionStateRef: React.MutableRefObject<CharacterActionState>;
  velocityRef: React.MutableRefObject<THREE.Vector3>;
  teamColor: string;
}

export const CharacterModel: React.FC<CharacterModelProps> = ({
  actionStateRef,
  velocityRef,
  teamColor,
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  // Materials
  const armorMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: teamColor, emissive: teamColor, emissiveIntensity: 0.15, roughness: 0.3, metalness: 0.8 
  }), [teamColor]);
  
  const jointMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#1e293b', roughness: 0.8, metalness: 0.2 
  }), []);
  
  const visorMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#ffffff', emissive: '#0ea5e9', emissiveIntensity: 1.5, toneMapped: false 
  }), []);

  // Flash material for 'hit' state
  const hitMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff', emissive: '#ff0000', emissiveIntensity: 2.5, toneMapped: false
  }), []);

  const walkTime = useRef(0);
  const hitTime = useRef(0);
  const prevAction = useRef<CharacterActionState>('idle');
  const randomSeed = useMemo(() => Math.random() * 100, []);

  useFrame((state, delta) => {
    if (!rootRef.current || !bodyRef.current || !headRef.current || !leftArmRef.current || !rightArmRef.current || !leftLegRef.current || !rightLegRef.current) return;

    const actionState = actionStateRef.current;
    const velocity = velocityRef.current;

    if (actionState === 'doubleJump' && prevAction.current !== 'doubleJump') {
      // Small boost reset for starting the flip
      bodyRef.current.rotation.x = 0; 
    }
    
    const speed = new THREE.Vector2(velocity.x, velocity.z).length();
    const speedFactor = Math.min(speed / 10, 1.5);
    
    // Reset rotations smoothly
    const t = 10 * delta;
    
    // Default targets
    let bRotX = 0, bRotY = 0, bRotZ = 0;
    let bPosY = 1.2; // Base elevation
    let hRotX = 0, hRotY = 0;
    let laRotX = 0, laRotZ = 0.2;
    let raRotX = 0, raRotZ = -0.2;
    let llRotX = 0, llRotZ = 0;
    let rlRotX = 0, rlRotZ = 0;

    if (actionState === 'dead') {
      bRotX = -Math.PI / 2;
      bPosY = 0.3;
      laRotX = Math.PI;
      raRotX = Math.PI;
      llRotX = 0;
      rlRotX = 0;
    } else if (actionState === 'hit') {
      hitTime.current += delta * 20;
      bRotY = Math.sin(hitTime.current) * 0.3;
      hRotX = -0.2;
      laRotZ = Math.PI / 2;
      raRotZ = -Math.PI / 2;
      bPosY = 1.2 + Math.sin(hitTime.current * 1.5) * 0.1;
    } else if (actionState === 'hooked') {
      // Flail
      const flail = state.clock.elapsedTime * 15 + randomSeed;
      laRotX = Math.sin(flail) * 1.5;
      raRotX = Math.cos(flail * 1.1) * 1.5;
      llRotX = Math.sin(flail * 0.9) * 0.8;
      rlRotX = Math.cos(flail * 1.2) * 0.8;
      
      // Tilt towards pull
      // In local space, 'z' is forward, but pullDir is global. We skip complex Math here and just tilt forward/up as being dragged
      bRotX = 0.5; 
      hRotX = -0.3;
      bPosY = 1.5; // Lifted slightly
    } else if (actionState === 'shoot') {
      // Right arm recoil and aim
      raRotX = Math.PI / 2; // Point forward
      raRotZ = 0;
      laRotX = -0.3; 
      bRotX = -0.2; // Body recoiling backward
      hRotX = 0.1;
    } else if (actionState === 'jump' || actionState === 'fall') {
      bPosY = actionState === 'jump' ? 1.4 : 1.0;
      bRotX = velocity.y > 0 ? 0.2 : -0.2;
      laRotX = Math.PI;
      raRotX = Math.PI;
      llRotX = actionState === 'jump' ? -0.2 : 0.4;
      rlRotX = actionState === 'jump' ? 0.2 : -0.4;
      hRotX = actionState === 'jump' ? 0.2 : -0.3;
    } else if (actionState === 'doubleJump') {
      bPosY = 1.4;
      laRotX = Math.PI * 0.8; // Tucked arms
      raRotX = Math.PI * 0.8;
      laRotZ = 0.5;
      raRotZ = -0.5;
      llRotX = -0.6; // Tucked legs
      rlRotX = -0.6;
      hRotX = 0.5; // Tucked head
      
      // Override bRotX manually inside lerp logic step below
    } else if (actionState === 'land') {
      bPosY = 0.8; // Squash down
      bRotX = 0.4; // Lean forward
      hRotX = 0.2;
      laRotX = -0.4; // Arms down and slightly back
      raRotX = -0.4;
      llRotX = -0.8; // Deep knee bends
      rlRotX = -0.8;
    } else {
      // Walk / Idle
      if (speedFactor > 0.05) {
        walkTime.current += delta * 15 * speedFactor;
        const w1 = Math.sin(walkTime.current);
        const w2 = Math.cos(walkTime.current);
        
        laRotX = w1 * 0.8;
        raRotX = -w1 * 0.8;
        llRotX = -w1 * 0.8;
        rlRotX = w1 * 0.8;
        
        bRotZ = w2 * 0.05;
        bRotY = w1 * 0.1;
        bPosY = 1.2 + Math.abs(w1) * 0.1;
      } else {
        // Breathe
        walkTime.current += delta;
        bPosY = 1.2 + Math.sin(walkTime.current * 2) * 0.05;
        laRotZ = 0.2 + Math.sin(walkTime.current * 2) * 0.05;
        raRotZ = -0.2 - Math.sin(walkTime.current * 2) * 0.05;
      }
    }

    // Apply Lerps for smooth transition
    const lerpRot = (ref: any, x: number, y: number, z: number, speed: number) => {
      ref.rotation.x = THREE.MathUtils.lerp(ref.rotation.x, x, speed);
      ref.rotation.y = THREE.MathUtils.lerp(ref.rotation.y, y, speed);
      ref.rotation.z = THREE.MathUtils.lerp(ref.rotation.z, z, speed);
    };

    lerpRot(bodyRef.current, bRotX, bRotY, bRotZ, t);
    
    // Front flip override
    if (actionState === 'doubleJump') {
      bodyRef.current.rotation.x -= delta * 12; // Fast forward spin
    } else if (prevAction.current === 'doubleJump') {
      // Snap to upright to prevent unwinding the full 360 degree Euler angle smoothly back to 0
      bodyRef.current.rotation.x = Math.PI * 2; // Close to nearest full rotation
    }

    bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, bPosY, t);
    
    lerpRot(headRef.current, hRotX, hRotY, 0, t);
    lerpRot(leftArmRef.current, laRotX, 0, laRotZ, t);
    lerpRot(rightArmRef.current, raRotX, 0, raRotZ, t);
    lerpRot(leftLegRef.current, llRotX, 0, llRotZ, t);
    lerpRot(rightLegRef.current, rlRotX, 0, rlRotZ, t);
    
    // Check material toggle roughly every frame based on state
    (bodyRef.current.children[0] as THREE.Mesh).material = actionStateRef.current === 'hit' ? hitMat : armorMat;
    
    prevAction.current = actionState;
  });

  return (
    <group ref={rootRef}>
      {/* Body Root (y=1.2 normal, offset inside lerp) */}
      <group ref={bodyRef} position={[0, 1.2, 0]}>
        
        {/* Torso */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.8, 0.5]} />
          <primitive object={armorMat} />
        </mesh>
        
        {/* Detail Core */}
        <mesh castShadow position={[0, 0, 0.26]}>
          <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
          <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.8} />
        </mesh>

        {/* Head */}
        <group ref={headRef} position={[0, 0.55, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <primitive object={armorMat} />
          </mesh>
          {/* Visor */}
          <mesh castShadow position={[0, 0.25, 0.26]}>
            <boxGeometry args={[0.4, 0.15, 0.05]} />
            <primitive object={visorMat} />
          </mesh>
        </group>

        {/* Left Arm Hub */}
        <group ref={leftArmRef} position={[0.45, 0.3, 0]}>
          <mesh castShadow position={[0, -0.3, 0]}>
            <boxGeometry args={[0.2, 0.7, 0.2]} />
            <primitive object={armorMat} />
          </mesh>
        </group>

        {/* Right Arm Hub */}
        <group ref={rightArmRef} position={[-0.45, 0.3, 0]}>
          <mesh castShadow position={[0, -0.3, 0]}>
            <boxGeometry args={[0.2, 0.7, 0.2]} />
            <primitive object={armorMat} />
          </mesh>
          {/* Hook launcher attachment on arm */}
          <mesh castShadow position={[0, -0.3, 0.15]}>
            <boxGeometry args={[0.1, 0.3, 0.1]} />
            <primitive object={jointMat} />
          </mesh>
        </group>

        {/* Left Leg Hub */}
        <group ref={leftLegRef} position={[0.2, -0.4, 0]}>
          <mesh castShadow position={[0, -0.4, 0]}>
            <boxGeometry args={[0.25, 0.8, 0.25]} />
            <primitive object={armorMat} />
          </mesh>
        </group>

        {/* Right Leg Hub */}
        <group ref={rightLegRef} position={[-0.2, -0.4, 0]}>
          <mesh castShadow position={[0, -0.4, 0]}>
            <boxGeometry args={[0.25, 0.8, 0.25]} />
            <primitive object={armorMat} />
          </mesh>
        </group>

      </group>
    </group>
  );
};
