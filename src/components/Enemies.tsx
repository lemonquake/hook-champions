import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, useRapier, interactionGroups, CapsuleCollider, BallCollider } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import * as YUKA from 'yuka';
import { useGameStore, EnemyData } from '../store';
import { CharacterModel, CharacterActionState } from './CharacterModel';
import { Trail } from '@react-three/drei';

const entityManager = new YUKA.EntityManager();

const BOT_SPEED = 8;
const HOOK_SPEED = 45.0;
const RETRACT_SPEED = 25.0;
const MAX_HOOK_LENGTH = 20;
const HOOK_COOLDOWN = 3;
const HOOK_DAMAGE = 50;

// Pre-allocated memory for zero-allocation chain rendering
const chainDummy = new THREE.Object3D();
const chainUp = new THREE.Vector3(0, 1, 0);
const chainMidPoint = new THREE.Vector3();
const chainCurve = new THREE.QuadraticBezierCurve3();
const chainPos = new THREE.Vector3();
const chainTangent = new THREE.Vector3();
const chainAxis = new THREE.Vector3();

export const Enemies: React.FC = () => {
  const enemies = useGameStore((state) => state.enemies);

  useFrame((_, delta) => {
    entityManager.update(delta);
  });

  return (
    <group>
      {(Object.values(enemies) as EnemyData[]).map((enemy) => (
        <Bot key={enemy.id} data={enemy} />
      ))}
    </group>
  );
};

const Bot: React.FC<{ data: EnemyData }> = ({ data }) => {
  const rbRef = useRef<RapierRigidBody>(null);
  const hookRef = useRef<RapierRigidBody>(null);
  const chainInstancedMesh = useRef<THREE.InstancedMesh>(null);
  const shurikenRef = useRef<THREE.Group>(null);
  
  const { world, rapier } = useRapier();
  const { camera } = useThree();
  const teamColor = useGameStore(state => state.teams.find(t => t.id === data.teamId)?.color || '#ff3333');

  const hookState = useRef({
    status: 'idle' as 'idle' | 'firing' | 'retracting',
    attachedTarget: null as string | null,
    attachedTargetHandle: null as number | null,
    lastFireTime: 0,
  });

  const actionStateRef = useRef<CharacterActionState>('idle');
  const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const isGrounded = useRef(false);
  const lastDustTime = useRef(0);
  const losVisible = useRef(true);

  const [chainGeo] = useState(() => new THREE.TorusGeometry(0.15, 0.06, 8, 16));
  const [chainMat] = useState(() => new THREE.MeshStandardMaterial({ 
    color: '#e2e8f0', 
    metalness: 1, 
    roughness: 0.2,
    emissive: teamColor,
    emissiveIntensity: 0.8
  }));

  // --- Yuka AI Setup ---
  const vehicle = useMemo(() => {
    const v = new YUKA.Vehicle();
    v.maxSpeed = BOT_SPEED;
    v.mass = 1;
    entityManager.add(v);
    return v;
  }, []);

  const seekBehavior = useMemo(() => new YUKA.SeekBehavior(), []);
  const separationBehavior = useMemo(() => new YUKA.SeparationBehavior(), []);
  
  useEffect(() => {
    seekBehavior.weight = 1.0;
    separationBehavior.weight = 1.5;
    
    vehicle.steering.add(seekBehavior);
    vehicle.steering.add(separationBehavior);

    return () => {
      entityManager.remove(vehicle);
    };
  }, [vehicle, seekBehavior, separationBehavior]);

  useFrame((state, delta) => {
    if (!rbRef.current || !hookRef.current) return;

    if (data.status === 'dead') {
      rbRef.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
      rbRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      actionStateRef.current = 'dead';
      hookState.current.status = 'idle';
      hookState.current.attachedTarget = null;
      hookState.current.attachedTargetHandle = null;
      return;
    }

    const myPos = rbRef.current.translation();
    const myPosVec = new THREE.Vector3(myPos.x, myPos.y, myPos.z);
    
    // --- Teleport Check (Respawn) ---
    const storeState = useGameStore.getState();
    const storePos = new THREE.Vector3(...storeState.enemies[data.id].position);
    if (myPosVec.distanceTo(storePos) > 10) {
      rbRef.current.setTranslation(storePos, true);
      rbRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      hookState.current.status = 'idle';
      hookState.current.attachedTarget = null;
      hookState.current.attachedTargetHandle = null;
      return;
    }

    // --- Line-of-Sight Check for Name Visibility ---
    const camPos = camera.position;
    const enemyHeadPos = new THREE.Vector3(myPos.x, myPos.y + 2.5, myPos.z);
    const toEnemy = enemyHeadPos.clone().sub(camPos);
    const enemyDist = toEnemy.length();
    const toEnemyDir = toEnemy.normalize();
    
    const losRay = new rapier.Ray(camPos, toEnemyDir);
    const losHit = world.castRay(losRay, enemyDist, true, interactionGroups(0, [0])); // Only check walls (group 0)
    
    if (losHit) {
      const hitDist = typeof (losHit as any).timeOfImpact === 'number' ? (losHit as any).timeOfImpact : 
                     (typeof (losHit as any).toi === 'function' ? (losHit as any).toi() : (losHit as any).toi);
      // If the wall is closer than the enemy, they're occluded
      losVisible.current = hitDist === undefined || isNaN(hitDist) || hitDist >= enemyDist - 1.0;
    } else {
      losVisible.current = true; // No wall in the way
    }

    // 1. Find nearest enemy
    let nearestDist = Infinity;
    let nearestPos: THREE.Vector3 | null = null;
    let nearestId: string | null = null;

    // Check player
    if (storeState.playerTeamId !== data.teamId && storeState.status === 'alive') {
      const pPos = new THREE.Vector3(...storeState.playerPosition);
      const dist = myPosVec.distanceTo(pPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPos = pPos;
        nearestId = 'player';
      }
    }

    // Check other bots
    (Object.values(storeState.enemies) as EnemyData[]).forEach(enemy => {
      if (enemy.id !== data.id && enemy.teamId !== data.teamId && enemy.status === 'alive') {
        const ePos = new THREE.Vector3(...enemy.position);
        const dist = myPosVec.distanceTo(ePos);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPos = ePos;
          nearestId = enemy.id;
        }
      }
    });

    // Sync position to Yuka
    vehicle.position.set(myPos.x, myPos.y, myPos.z);

    // 2. AI Movement & Aiming (Yuka driven)
    const isBeingHooked = rbRef.current.bodyType() === rapier.RigidBodyType.KinematicPositionBased;
    if (!isBeingHooked && nearestPos && hookState.current.status === 'idle') {
      seekBehavior.target.set(nearestPos.x, nearestPos.y, nearestPos.z);

      const distToTarget = myPosVec.distanceTo(nearestPos);
      if (distToTarget < 0.1) return; // Avoid NaN from zero-length vector

      let moveDir = new THREE.Vector3(vehicle.velocity.x, 0, vehicle.velocity.z).normalize();
      
      // Simple obstacle avoidance (raycast forward) on top of Yuka
      const rayOrigin = new THREE.Vector3(myPos.x, myPos.y + 0.5, myPos.z);
      const rayDir = new THREE.Vector3(vehicle.velocity.x, 0, vehicle.velocity.z).normalize();
      if (rayDir.lengthSq() > 0) {
        const ray = new rapier.Ray(rayOrigin, rayDir);
        const hit = world.castRay(ray, 3, true, interactionGroups(1, [0])); // Check walls
        if (hit) {
          // Steer away from wall
          moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        }
      }

      // Move via Rapier (Overrides Yuka's built-in position update)
      // Check for maim debuff
      const isMaimed = useGameStore.getState().isMaimed(data.id);
      
      if (isMaimed) {
        // Being knocked back — decouple from AI movement overrides
        const currentVel = rbRef.current.linvel();
        const drag = 20 * delta;
        const newVelX = Math.abs(currentVel.x) > drag ? currentVel.x - Math.sign(currentVel.x)*drag : 0;
        const newVelZ = Math.abs(currentVel.z) > drag ? currentVel.z - Math.sign(currentVel.z)*drag : 0;
        rbRef.current.setLinvel({ x: newVelX, y: currentVel.y, z: newVelZ }, true);
      } else {
        if (nearestDist > 8) {
          const linVel = rbRef.current.linvel();
          rbRef.current.setLinvel({ x: moveDir.x * BOT_SPEED, y: linVel.y, z: moveDir.z * BOT_SPEED }, true);
        } else {
          // Stop and shoot
          rbRef.current.setLinvel({ x: 0, y: rbRef.current.linvel().y, z: 0 }, true);
        }
      }

      // Look at target (Y zeroed for body rotation only)
      const lookDir = nearestPos.clone().sub(myPosVec).normalize();
      const lookDirFlat = new THREE.Vector3(lookDir.x, 0, lookDir.z).normalize();
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), lookDirFlat);
      rbRef.current.setRotation(targetQuat, true);

      // 3. Shoot Hook — aim at the target's actual collision position (including height)
      const now = performance.now() / 1000;
      // Check for hook penalty (snagged by another unit)
      const hookPenalty = useGameStore.getState().hookPenalties[data.id] || 0;
      const penaltyCooldownRemaining = Math.max(0, HOOK_COOLDOWN - (now - hookPenalty));
      if (nearestDist <= MAX_HOOK_LENGTH && now - hookState.current.lastFireTime > HOOK_COOLDOWN && penaltyCooldownRemaining <= 0) {
        hookState.current.lastFireTime = now; // Track fire time for in-flight timeout
        hookState.current.status = 'firing';
        hookState.current.attachedTarget = null; // FIX LEAK
        hookState.current.attachedTargetHandle = null;
        
        useGameStore.getState().recordShot(data.id, false);
        
        // Aim at target's center mass (position + 1.0 for capsule center)
        const targetCenter = nearestPos.clone();
        targetCenter.y += 1.0; // Aim at chest height of target
        const aimOrigin = new THREE.Vector3(myPos.x, myPos.y + 1.0, myPos.z);
        const aimDir = targetCenter.sub(aimOrigin).normalize();
        const origin = aimOrigin.add(aimDir.clone().multiplyScalar(1.5));
        
        hookRef.current.setBodyType(rapier.RigidBodyType.Dynamic, true);
        hookRef.current.setTranslation(origin, true);
        hookRef.current.setLinvel(aimDir.multiplyScalar(HOOK_SPEED), true);
      }
    }
    
    // --- Hazard & Pitfall Logic ---
    let extraForceX = 0;
    let extraForceZ = 0;
    let extraForceY = 0;
    let inwardDir: THREE.Vector3 | null = null;
    
    if (storeState.mapConfig.theme === 'Volcano') {
      if (myPos.y < -1.0 && data.status !== 'dead') {
        useGameStore.getState().damageEnemy(data.id, 50 * delta, 'hazard');
      }
    } else {
      if (myPos.y < -12 && data.status !== 'dead') {
        useGameStore.getState().damageEnemy(data.id, 9999, 'hazard');
        useGameStore.getState().spawnEffect('blood_explosion', [myPos.x, -12, myPos.z], '#991b1b');
      } else if (myPos.y < -2 && data.status !== 'dead') {
        // Brutal vacuum gravity effect when falling
        extraForceY = -30 * delta; 
        inwardDir = new THREE.Vector3(-myPos.x, 0, -myPos.z).normalize();
        extraForceX = inwardDir.x * 10 * delta; // Constant inward pull
        extraForceZ = inwardDir.z * 10 * delta;
      }
    }

    if (!isBeingHooked && (extraForceX !== 0 || extraForceY !== 0 || extraForceZ !== 0)) {
      const currentVel = rbRef.current.linvel();
      // If falling into trap, override horizontal velocity completely for the pull effect 
      if (myPos.y < -2 && storeState.mapConfig.theme !== 'Volcano') {
           rbRef.current.setLinvel({ x: inwardDir?.x ? inwardDir.x*10 : 0, y: currentVel.y + extraForceY, z: inwardDir?.z ? inwardDir.z*10 : 0 }, true);
      } else {
           rbRef.current.setLinvel({ x: currentVel.x + extraForceX, y: currentVel.y + extraForceY, z: currentVel.z + extraForceZ }, true);
      }
    }

    // --- State Update ---
    const linVel = rbRef.current.linvel();
    if (!isBeingHooked) {
      velocityRef.current.set(linVel.x, linVel.y, linVel.z);
    } else {
      velocityRef.current.set(0, 0, 0);
    }
    
    if (isBeingHooked) {
      actionStateRef.current = 'hooked';
    } else if (hookState.current.status === 'retracting' && hookState.current.attachedTarget) {
      actionStateRef.current = 'shoot';
      if (state.clock.elapsedTime - lastDustTime.current > 0.1 && linVel.x*linVel.x + linVel.z*linVel.z > 5) {
        lastDustTime.current = state.clock.elapsedTime;
        useGameStore.getState().spawnEffect('dust', [myPos.x, myPos.y, myPos.z], '#64748b');
      }
    } else if (hookState.current.status === 'firing') {
      actionStateRef.current = 'shoot';
    } else if (linVel.x*linVel.x + linVel.z*linVel.z > 0.1) {
      actionStateRef.current = 'walk';
    } else {
      actionStateRef.current = 'idle';
    }

    // Update store position
    storeState.enemies[data.id].position = [myPos.x, myPos.y, myPos.z];

    // --- Hook Logic (Similar to Player) ---
    const hookPos = hookRef.current.translation();
    const pPos = new THREE.Vector3(myPos.x, myPos.y + 1, myPos.z);
    const hPos = new THREE.Vector3(hookPos.x, hookPos.y, hookPos.z);
    const dist = pPos.distanceTo(hPos);

    if (hookState.current.status === 'idle') {
      if (hookRef.current.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) {
        hookRef.current.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      }
      hookRef.current.setNextKinematicTranslation({ x: 0, y: -1000, z: 0 });
      if (chainInstancedMesh.current) chainInstancedMesh.current.count = 0;
    } 
    else if (hookState.current.status === 'firing') {
      if (shurikenRef.current) {
        shurikenRef.current.rotation.y += delta * 30;
        shurikenRef.current.rotation.x += delta * 15;
      }
      const now = performance.now() / 1000;
      if (dist > MAX_HOOK_LENGTH || now - hookState.current.lastFireTime > 1.5) {
        hookState.current.status = 'retracting';
      }
    } 
    else if (hookState.current.status === 'retracting') {
      if (hookRef.current.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) {
        hookRef.current.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      }

      // Constant-speed retraction — never slowed down by anything
      const dir = pPos.clone().sub(hPos);
      const distanceToPlayer = dir.length();
      const step = RETRACT_SPEED * delta;
      const newPos = step >= distanceToPlayer
        ? pPos.clone()
        : hPos.clone().add(dir.normalize().multiplyScalar(step));
      hookRef.current.setNextKinematicTranslation(newPos);

      if (shurikenRef.current) {
        shurikenRef.current.rotation.y -= delta * 30;
        shurikenRef.current.rotation.x -= delta * 15;
      }

      if (hookState.current.attachedTargetHandle !== null) {
        const targetBody = world.getRigidBody(hookState.current.attachedTargetHandle);
        if (targetBody) {
          if (targetBody.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) {
            targetBody.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
          }
          targetBody.setNextKinematicTranslation({ x: newPos.x, y: Math.max(1, newPos.y - 1), z: newPos.z });
        }
      }

      if (dist < 2 || distanceToPlayer < step) {
        hookState.current.status = 'idle';
        // Cooldown starts NOW (on arrival), not when fired
        hookState.current.lastFireTime = performance.now() / 1000;
        
        if (hookState.current.attachedTarget) {
          if (hookState.current.attachedTarget === 'player') {
            // Damage only if not teammate
            if (useGameStore.getState().playerTeamId !== data.teamId) {
              useGameStore.getState().damagePlayer(HOOK_DAMAGE, data.id);
              useGameStore.getState().recordShot(data.id, true);
              const ppos = useGameStore.getState().playerPosition;
              useGameStore.getState().spawnEffect('impact', [ppos[0], ppos[1], ppos[2]], '#ef4444');
            }
          } else {
            // Damage only if not teammate
            const targetData = useGameStore.getState().enemies[hookState.current.attachedTarget];
            if (targetData && targetData.teamId !== data.teamId) {
              useGameStore.getState().damageEnemy(hookState.current.attachedTarget, HOOK_DAMAGE, data.id);
              useGameStore.getState().recordShot(data.id, true);
              useGameStore.getState().spawnEffect('impact', [targetData.position[0], targetData.position[1], targetData.position[2]], '#eab308');
            }
          }
          
          // Apply hook penalty to the snagged target (their hook goes on cooldown)
          useGameStore.getState().applyHookPenalty(hookState.current.attachedTarget);
          
          if (hookState.current.attachedTargetHandle !== null) {
            const targetBody = world.getRigidBody(hookState.current.attachedTargetHandle);
            if (targetBody) {
              targetBody.setBodyType(rapier.RigidBodyType.Dynamic, true);
            }
          }
          
          hookState.current.attachedTarget = null;
          hookState.current.attachedTargetHandle = null;
        }
      }
    }

    // --- Draw Chain ---
    if (chainInstancedMesh.current && hookState.current.status !== 'idle') {
      const linkLength = 0.4;
      const numLinks = Math.min(150, Math.floor(dist / linkLength));
      chainInstancedMesh.current.count = numLinks;
      
      chainMidPoint.addVectors(pPos, hPos).multiplyScalar(0.5);
      const droopAmount = hookState.current.status === 'retracting' && hookState.current.attachedTarget ? 0.2 : Math.min(dist * 0.2, 2.0);
      chainMidPoint.y -= droopAmount;
      
      chainCurve.v0.copy(pPos);
      chainCurve.v1.copy(chainMidPoint);
      chainCurve.v2.copy(hPos);

      for (let i = 0; i < numLinks; i++) {
        const t = i / (numLinks - 1 || 1);
        chainCurve.getPoint(t, chainPos);
        chainCurve.getTangent(t, chainTangent);

        chainDummy.position.copy(chainPos);
        
        chainAxis.crossVectors(chainUp, chainTangent).normalize();
        const radians = Math.acos(Math.max(-1, Math.min(1, chainUp.dot(chainTangent))));
        chainDummy.quaternion.setFromAxisAngle(chainAxis, radians);
        
        chainDummy.rotateX(Math.PI / 2);
        if (i % 2 === 0) chainDummy.rotateY(Math.PI / 2);
        
        chainDummy.updateMatrix();
        chainInstancedMesh.current.setMatrixAt(i, chainDummy.matrix);
      }
      chainInstancedMesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <RigidBody 
        ref={rbRef} 
        type="dynamic" 
        colliders={false} 
        mass={1} 
        position={data.position} 
        name={data.id}
        enabledRotations={[false, false, false]}
        collisionGroups={interactionGroups(1, [0, 1, 2])}
      >
        <CapsuleCollider args={[0.5, 0.5]} position={[0, 1, 0]} />
        <CharacterModel actionStateRef={actionStateRef} velocityRef={velocityRef} teamColor={teamColor} />
        
        {/* HP Bar - Only visible when in line of sight */}
        {losVisible.current && (
          <Html position={[0, 2.5, 0]} center transform sprite>
            <div className="flex flex-col items-center pointer-events-none">
              <div className="text-xs font-bold text-white drop-shadow-md mb-1">{data.name}</div>
              <div className="w-16 h-2 bg-gray-900 border border-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-200" 
                  style={{ width: `${(data.hp / data.maxHp) * 100}%`, backgroundColor: teamColor }} 
                />
              </div>
            </div>
          </Html>
        )}
      </RigidBody>

      {/* Hook Projectile */}
      <RigidBody
        ref={hookRef}
        type="dynamic"
        colliders={false}
        ccd
        gravityScale={0}
        restitution={1}
        friction={0}
        linearDamping={0}
        angularDamping={0}
        position={[0, -1000, 0]}
        collisionGroups={interactionGroups(2, [0, 1])}
        onCollisionEnter={(e) => {
          if (hookState.current.status !== 'firing') return;
          
          // @ts-ignore
          const name = e.other.rigidBodyObject?.userData?.name || e.other.rigidBodyObject?.name;
          
          if (name === data.id) return; // Prevent snagging on self
          
          if (name && (name.startsWith('enemy') || name.startsWith('bot') || name === 'player')) {
            hookState.current.status = 'retracting'; // Always retract on HIT
            hookState.current.attachedTarget = name;
            
            useGameStore.getState().applyMaim(name);
            useGameStore.getState().applyPushCredit(name, data.id);
            
            const ep = e.other.rigidBody?.translation();
            if (ep) useGameStore.getState().spawnEffect('impact', [ep.x, ep.y, ep.z], '#eab308');
            
            const targetBody = e.other.rigidBody;
            if (targetBody) {
              hookState.current.attachedTargetHandle = targetBody.handle;
            }
          } else {
             const pos = hookRef.current.translation();
             useGameStore.getState().spawnEffect('impact', [pos.x, pos.y, pos.z], '#94a3b8');
          }
        }}
      >
        <BallCollider args={[0.3]} />
        <Trail width={1.5} length={20} color={teamColor} attenuation={(t) => t * t}>
        <group ref={shurikenRef}>
          <mesh castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
            <meshStandardMaterial metalness={1} roughness={0.05} color="#ffffff" />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh 
              key={i} 
              position={[Math.cos(i * Math.PI/2) * 0.3, 0, Math.sin(i * Math.PI/2) * 0.3]} 
              rotation={[0, -i * Math.PI/2, -Math.PI/2]} 
              castShadow
            >
              <coneGeometry args={[0.1, 0.4, 4]} />
              <meshStandardMaterial metalness={1} roughness={0.05} color="#ffffff" />
            </mesh>
          ))}
        </group>
        </Trail>
      </RigidBody>

      <instancedMesh ref={chainInstancedMesh} args={[chainGeo, chainMat, 150]} castShadow frustumCulled={false} />
    </>
  );
};
