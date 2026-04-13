import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, useRapier, interactionGroups, CapsuleCollider, BallCollider } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import * as YUKA from 'yuka';
import { useGameStore, EnemyData } from '../store';
import { CharacterModel, CharacterActionState } from './CharacterModel';
import { Trail } from '@react-three/drei';
import { BotEntity, WanderState, CombatState, FleeState } from '../ai/BotStateMachine';

const entityManager = new YUKA.EntityManager();

const BOT_SPEED = 8;
const HOOK_SPEED = 45.0;
const RETRACT_SPEED = 25.0;
const MAX_HOOK_LENGTH = 20;
const HOOK_COOLDOWN = 3;
const HOOK_DAMAGE = 50;

const chainDummy = new THREE.Object3D();
const chainUp = new THREE.Vector3(0, 1, 0);
const chainMidPoint = new THREE.Vector3();
const chainCurve = new THREE.QuadraticBezierCurve3();
const chainPos = new THREE.Vector3();
const chainTangent = new THREE.Vector3();
const chainAxis = new THREE.Vector3();

// Pre-allocated variables to avoid GC in useFrame
const _myPosVec = new THREE.Vector3();
const _storePos = new THREE.Vector3();
const _enemyHeadPos = new THREE.Vector3();
const _toEnemyDir = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _nextPos = new THREE.Vector3();
const _floorRayOrigin = new THREE.Vector3();
const _floorRayDir = new THREE.Vector3(0, -1, 0);
const _inward = new THREE.Vector3();
const _lookFocus = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _targetToCenter = new THREE.Vector3();
const _cliffCheckOrigin = new THREE.Vector3();
const _aimOrigin = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _pPos = new THREE.Vector3();
const _hPos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _newPos = new THREE.Vector3();
const _pushForce = new THREE.Vector3();

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
  const hookObjRef = useRef<THREE.Group>(null);
  
  const { world, rapier } = useRapier();
  const { camera } = useThree();
  const teamColor = useGameStore(state => state.teams.find(t => t.id === data.teamId)?.color || '#ff3333');

  const hookState = useRef({
    status: 'idle' as 'idle' | 'firing' | 'retracting',
    attachedTarget: null as string | null,
    attachedTargetHandle: null as number | null,
    lastFireTime: 0,
    actionType: 'hook' as 'hook' | 'push'
  });

  const actionStateRef = useRef<CharacterActionState>('idle');
  const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const lastDustTime = useRef(0);
  const losVisible = useRef(true);
  const lastTacticalTime = useRef(0);
  const isFloorSafe = useRef(true);

  // Use bot's economy purchases
  const tipType = data.hookTip || 'shuriken';
  const linkType = data.chainLink || 'torus';

  const [chainGeo] = useState(() => {
     if (linkType === 'box') return new THREE.BoxGeometry(0.2, 0.2, 0.2);
     if (linkType === 'cylinder') return new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
     if (linkType === 'ring') return new THREE.TorusGeometry(0.1, 0.03, 8, 16);
     if (linkType === 'chainmail') return new THREE.IcosahedronGeometry(0.15, 0);
     return new THREE.TorusGeometry(0.15, 0.06, 8, 16);
  });
  
  const [chainMat] = useState(() => new THREE.MeshStandardMaterial({ 
    color: '#e2e8f0', 
    metalness: 1, 
    roughness: 0.2,
    emissive: teamColor,
    emissiveIntensity: 0.8
  }));

  // --- Yuka AI StateMachine Setup ---
  const vehicle = useMemo(() => {
    const v = new BotEntity(data.id) as any;
    v.maxSpeed = BOT_SPEED;
    v.mass = 1;
    v.smoother = new YUKA.Smoother(5); // smoothing for erratic movement
    
    const stateMachine = new YUKA.StateMachine(v);
    stateMachine.add('WANDER', new WanderState());
    stateMachine.add('COMBAT', new CombatState());
    stateMachine.add('FLEE', new FleeState());
    stateMachine.changeTo('WANDER');
    
    // @ts-ignore
    v.stateMachine = stateMachine;
    v.setRenderComponent(rbRef, () => {}); // we manually sync in loop

    entityManager.add(v);
    return v;
  }, [data.id]);

  useEffect(() => {
    return () => {
      entityManager.remove(vehicle);
    };
  }, [vehicle]);

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
    _myPosVec.set(myPos.x, myPos.y, myPos.z);
    
    // --- Teleport Check ---
    const storeState = useGameStore.getState();
    const sfPos = storeState.enemies[data.id].position;
    _storePos.set(sfPos[0], sfPos[1], sfPos[2]);
    if (_myPosVec.distanceTo(_storePos) > 10) {
      rbRef.current.setTranslation(_storePos, true);
      rbRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const nowSeconds = state.clock.elapsedTime;
    const updateTactical = nowSeconds - lastTacticalTime.current > 0.1; // 10 Hz
    if (updateTactical) {
      lastTacticalTime.current = nowSeconds;
      
      // --- Line of Sight ---
      const camPos = camera.position;
      _enemyHeadPos.set(myPos.x, myPos.y + 2.5, myPos.z);
      _toEnemyDir.copy(_enemyHeadPos).sub(camPos).normalize();
      const losRay = new rapier.Ray(camPos, _toEnemyDir);
      const dist = _enemyHeadPos.distanceTo(camPos);
      const losHit = world.castRay(losRay, dist, true, interactionGroups(0, [0]));
      losVisible.current = !losHit || (losHit as any).toi >= dist - 1.0;
    }

    // --- AI Updates ---
    // @ts-ignore
    vehicle.stateMachine.update();
    vehicle.position.set(myPos.x, myPos.y, myPos.z);

    const isBeingHooked = rbRef.current.bodyType() === rapier.RigidBodyType.KinematicPositionBased;
    
    if (!isBeingHooked && hookState.current.status === 'idle') {
      // Base movement from Yuka steering
      const v = vehicle as any;
      _moveDir.set(v.velocity.x, 0, v.velocity.z).normalize();
      
      const isMaimed = useGameStore.getState().isMaimed(data.id);
      
      // --- CLIFF AVOIDANCE (Safety Check) ---
      if (updateTactical) {
        _nextPos.copy(_myPosVec).add(_moveDir.multiplyScalar(BOT_SPEED * 0.5));
        _floorRayOrigin.set(_nextPos.x, myPos.y + 0.5, _nextPos.z);
        const floorHit = world.castRay(new rapier.Ray(_floorRayOrigin, _floorRayDir), 5, true, interactionGroups(1, [0]));
        isFloorSafe.current = !!floorHit && _nextPos.lengthSq() <= 35*35;
      }
      
      if (!isFloorSafe.current) {
         // Massive steering force inwards to prevent suicide
         _inward.set(-myPos.x, 0, -myPos.z).normalize();
         _moveDir.lerp(_inward, 0.9).normalize();
      }
      // Random jump / dodge due to evasiveness
      if (updateTactical && data.evasiveness > Math.random() * 5 && myPos.y < 1.0) {
         rbRef.current.applyImpulse({ x: 0, y: 5 + Math.random()*5, z: 0 }, true);
      }

      if (isMaimed) {
        const currentVel = rbRef.current.linvel();
        const drag = 20 * delta;
        const newVelX = Math.abs(currentVel.x) > drag ? currentVel.x - Math.sign(currentVel.x)*drag : 0;
        const newVelZ = Math.abs(currentVel.z) > drag ? currentVel.z - Math.sign(currentVel.z)*drag : 0;
        rbRef.current.setLinvel({ x: newVelX, y: currentVel.y, z: newVelZ }, true);
      } else {
        const linVel = rbRef.current.linvel();
        rbRef.current.setLinvel({ x: _moveDir.x * BOT_SPEED, y: linVel.y, z: _moveDir.z * BOT_SPEED }, true);
      }

      // Look at logic
      // @ts-ignore
      const targetPos = vehicle.combatTargetPos;
      
      if (targetPos && _moveDir.lengthSq() < 0.1) {
          _lookFocus.copy(targetPos);
      } else {
          _lookFocus.copy(_myPosVec).add(_moveDir);
      }
      
      _lookDir.copy(_lookFocus).sub(_myPosVec);
      _lookDir.y = 0;
      if (_lookDir.lengthSq() > 0.01) {
         _lookDir.normalize();
         _targetQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), _lookDir);
         // slerp the rotation for smoothness
         const curRot = rbRef.current.rotation();
         const smoothQuat = new THREE.Quaternion(curRot.x, curRot.y, curRot.z, curRot.w).slerp(_targetQuat, 10 * delta);
         rbRef.current.setRotation(smoothQuat, true);
      }

      // --- TACTICAL COMBAT ---
      if (targetPos && vehicle.combatTargetDist <= MAX_HOOK_LENGTH) {
        const now = performance.now() / 1000;
        const hookPenalty = useGameStore.getState().hookPenalties[data.id] || 0;
        if (now - hookState.current.lastFireTime > HOOK_COOLDOWN && now - hookPenalty > HOOK_COOLDOWN) {
           
           let actionType: 'push' | 'hook' = 'hook';
           if (updateTactical) {
             // Tactical Check: If we shove them, will they fall?
             _targetToCenter.set(-targetPos.x, 0, -targetPos.z).normalize();
             _cliffCheckOrigin.copy(targetPos).add(new THREE.Vector3(0, 1, 0)).sub(_targetToCenter.multiplyScalar(5));
             const cliffFloorRay = world.castRay(new rapier.Ray(_cliffCheckOrigin, _floorRayDir), 5, true, interactionGroups(1, [0]));
             actionType = (!cliffFloorRay || Math.random() < 0.1) ? 'push' : 'hook';
             hookState.current.actionType = actionType;
           } else {
             actionType = hookState.current.actionType as any;
           }
           
           hookState.current.lastFireTime = now;
           hookState.current.status = 'firing';
           hookState.current.attachedTarget = null;
           hookState.current.attachedTargetHandle = null;
           
           useGameStore.getState().recordShot(data.id, false);
           
           // Random fuzziness / accuracy adaptation based on predictionLead
           const fuzzyFactor = (Math.random() - 0.5) * (2.0 - data.predictionLead);
           _aimOrigin.set(myPos.x, myPos.y + 1.0, myPos.z);
           _aimDir.copy(targetPos).add(new THREE.Vector3(fuzzyFactor, 1.0, fuzzyFactor)).sub(_aimOrigin).normalize();
           _newPos.copy(_aimOrigin).add(_aimDir.multiplyScalar(1.5));
           
           hookRef.current.setBodyType(rapier.RigidBodyType.Dynamic, true);
           hookRef.current.setTranslation(_newPos, true);
           hookRef.current.setLinvel(_aimDir.normalize().multiplyScalar(HOOK_SPEED), true);
        }
      }
    }
    
    // --- Hazard & Pitfall Logic ---
    let extraForceX = 0, extraForceZ = 0, extraForceY = 0;
    
    if (myPos.y < -12) {
      useGameStore.getState().damageEnemy(data.id, 9999, 'hazard');
      useGameStore.getState().spawnEffect('blood_explosion', [myPos.x, -12, myPos.z], '#991b1b');
    } else if (myPos.y < -2) {
      // Vacuum pull
      extraForceY = -30 * delta; 
      _inward.set(-myPos.x, 0, -myPos.z).normalize();
      extraForceX = _inward.x * 10 * delta;
      extraForceZ = _inward.z * 10 * delta;
    }

    if (!isBeingHooked && (extraForceX !== 0 || extraForceY !== 0 || extraForceZ !== 0)) {
      const currentVel = rbRef.current.linvel();
      rbRef.current.setLinvel({ x: currentVel.x + extraForceX, y: currentVel.y + extraForceY, z: currentVel.z + extraForceZ }, true);
    }

    // --- Animation State ---
    const linVel = rbRef.current.linvel();
    if (!isBeingHooked) velocityRef.current.set(linVel.x, linVel.y, linVel.z);
    
    if (isBeingHooked) {
      actionStateRef.current = 'hooked';
    } else if (hookState.current.status === 'retracting' && hookState.current.attachedTarget) {
      actionStateRef.current = 'shoot';
    } else if (hookState.current.status === 'firing') {
      actionStateRef.current = 'shoot';
    } else if (linVel.x*linVel.x + linVel.z*linVel.z > 0.1) {
      actionStateRef.current = 'walk';
    } else {
      actionStateRef.current = 'idle';
    }

    storeState.enemies[data.id].position = [myPos.x, myPos.y, myPos.z];

    // --- Hook Logic ---
    const hookPos = hookRef.current.translation();
    _pPos.set(myPos.x, myPos.y + 1, myPos.z);
    _hPos.set(hookPos.x, hookPos.y, hookPos.z);
    const dist = _pPos.distanceTo(_hPos);

    if (hookState.current.status === 'idle') {
      if (hookRef.current.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) {
        hookRef.current.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      }
      hookRef.current.setNextKinematicTranslation({ x: 0, y: -1000, z: 0 });
      if (chainInstancedMesh.current) chainInstancedMesh.current.count = 0;
    } 
    else if (hookState.current.status === 'firing') {
      if (hookObjRef.current) {
        hookObjRef.current.rotation.y += delta * 30;
      }
      const now = performance.now() / 1000;
      if (dist > MAX_HOOK_LENGTH || now - hookState.current.lastFireTime > 1.5) {
        hookState.current.status = 'retracting';
        if (!hookState.current.attachedTarget && data.predictionLead > 0.1) {
            // "Learning": we missed. Try to lead less extremely next time (or randomize)
            storeState.setStats({ enemies: { ...storeState.enemies, [data.id]: { ...data, predictionLead: data.predictionLead - 0.1 } } });
        }
      }
    } 
    else if (hookState.current.status === 'retracting') {
      if (hookRef.current.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) {
        hookRef.current.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      }

      _dir.copy(_pPos).sub(_hPos);
      const step = RETRACT_SPEED * delta;
      
      if (step >= _dir.length()) {
          _newPos.copy(_pPos);
      } else {
          _newPos.copy(_hPos).add(_dir.normalize().multiplyScalar(step));
      }
      
      hookRef.current.setNextKinematicTranslation({ x: _newPos.x, y: _newPos.y, z: _newPos.z });

      if (hookObjRef.current) hookObjRef.current.rotation.y -= delta * 30;

      if (hookState.current.attachedTargetHandle !== null && hookState.current.actionType === 'hook') {
        const targetBody = world.getRigidBody(hookState.current.attachedTargetHandle);
        if (targetBody) {
          if (targetBody.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) targetBody.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
          targetBody.setNextKinematicTranslation({ x: _newPos.x, y: Math.max(1, _newPos.y - 1), z: _newPos.z });
        }
      }

      if (dist < 2 || _dir.length() < step) {
        hookState.current.status = 'idle';
        hookState.current.lastFireTime = performance.now() / 1000;
        
        if (hookState.current.attachedTarget) {
            // Reward hit ratio
            storeState.setStats({ enemies: { ...storeState.enemies, [data.id]: { ...data, predictionLead: Math.min(2.0, data.predictionLead + 0.2) } } });
            
            const targetColor = hookState.current.attachedTarget === 'player' ? '#ef4444' : '#eab308';
            if (hookState.current.attachedTarget === 'player' && storeState.playerTeamId !== data.teamId) {
                storeState.damagePlayer(HOOK_DAMAGE, data.id);
                storeState.recordShot(data.id, true);
                storeState.spawnEffect('impact', storeState.playerPosition, targetColor);
            } else {
                const targetData = storeState.enemies[hookState.current.attachedTarget];
                if (targetData && targetData.teamId !== data.teamId) {
                    storeState.damageEnemy(hookState.current.attachedTarget, HOOK_DAMAGE, data.id);
                    storeState.recordShot(data.id, true);
                    storeState.spawnEffect('impact', targetData.position, targetColor);
                }
            }
            
            storeState.applyHookPenalty(hookState.current.attachedTarget);
            
            if (hookState.current.attachedTargetHandle !== null) {
              const targetBody = world.getRigidBody(hookState.current.attachedTargetHandle);
              if (targetBody) targetBody.setBodyType(rapier.RigidBodyType.Dynamic, true);
            }
        }
        hookState.current.attachedTarget = null;
        hookState.current.attachedTargetHandle = null;
      }
    }

    // --- Draw Chain ---
    if (chainInstancedMesh.current && hookState.current.status !== 'idle') {
      chainInstancedMesh.current.visible = hookState.current.actionType === 'hook';
      
      if (chainInstancedMesh.current.visible) {
          const linkLength = 0.4;
          const numLinks = Math.min(150, Math.floor(dist / linkLength));
          chainInstancedMesh.current.count = numLinks;
          
          chainMidPoint.addVectors(_pPos, _hPos).multiplyScalar(0.5);
          const droopAmount = hookState.current.status === 'retracting' && hookState.current.attachedTarget ? 0.2 : Math.min(dist * 0.2, 2.0);
          chainMidPoint.y -= droopAmount;
          
          chainCurve.v0.copy(_pPos);
          chainCurve.v1.copy(chainMidPoint);
          chainCurve.v2.copy(_hPos);

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
        
        {losVisible.current && (
          <Html position={[0, 2.5, 0]} center transform sprite zIndexRange={[100,0]}>
            <div className="flex flex-col items-center pointer-events-none">
              <div className="text-xs font-bold text-white drop-shadow-md mb-1">{data.name}</div>
              {data.points > 0 && <div className="text-[10px] text-yellow-400 drop-shadow-md -mt-1 mb-1">${data.points}</div>}
              <div className="w-16 h-2 bg-gray-900 border border-gray-700 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-200" style={{ width: `${(data.hp / data.maxHp) * 100}%`, backgroundColor: teamColor }} />
              </div>
            </div>
          </Html>
        )}
      </RigidBody>

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
          if (name === data.id) return;
          
          if (name && (name.startsWith('enemy') || name.startsWith('bot') || name === 'player')) {
            hookState.current.status = 'retracting';
            if (hookState.current.actionType === 'push') {
                // Instantly repel
                const eOtherPos = e.other.rigidBody?.translation();
                _pushForce.set(eOtherPos?.x || 0, eOtherPos?.y || 0, eOtherPos?.z || 0).sub(_myPosVec).normalize().multiplyScalar(40);
                _pushForce.y = 15;
                e.other.rigidBody?.applyImpulse(_pushForce, true);
                useGameStore.getState().spawnEffect('blood_explosion', [eOtherPos?.x || 0, eOtherPos?.y || 0, eOtherPos?.z || 0], '#d946ef');
            } else {
                hookState.current.attachedTarget = name;
                hookState.current.attachedTargetHandle = e.other.rigidBody?.handle || null;
                const ep = e.other.rigidBody?.translation();
                if (ep) useGameStore.getState().spawnEffect('impact', [ep.x, ep.y, ep.z], '#eab308');
            }
            useGameStore.getState().applyMaim(name);
            useGameStore.getState().applyPushCredit(name, data.id);
          } else {
             const pos = hookRef.current.translation();
             useGameStore.getState().spawnEffect('impact', [pos.x, pos.y, pos.z], '#94a3b8');
          }
        }}
      >
        <BallCollider args={[0.3]} />
        <Trail width={1.5} length={20} color={hookState.current.actionType === 'push' ? '#d946ef' : teamColor} attenuation={(t) => t * t}>
        <group ref={hookObjRef}>
          {tipType === 'shuriken' && (
             <mesh castShadow>
               <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
               <meshStandardMaterial metalness={1} roughness={0.05} color="#ffffff" />
             </mesh>
          )}
          {tipType === 'anchor' && (
             <mesh castShadow rotation={[0,0,Math.PI/2]}>
               <torusGeometry args={[0.4, 0.1, 8, 16, Math.PI]} />
               <meshStandardMaterial metalness={1} roughness={0.05} color="#ffffff" />
             </mesh>
          )}
          {tipType === 'scythe' || tipType === 'trident' || tipType === 'harpoon' ? (
              <mesh castShadow>
                <coneGeometry args={[0.2, 0.8, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.05} color="#ffffff" />
              </mesh>
          ) : null}
          {[0, 1, 2, 3].map((i) => (
             tipType === 'shuriken' ? (
                <mesh key={i} position={[Math.cos(i * Math.PI/2) * 0.3, 0, Math.sin(i * Math.PI/2) * 0.3]} rotation={[0, -i * Math.PI/2, -Math.PI/2]} castShadow>
                <coneGeometry args={[0.1, 0.4, 4]} />
                <meshStandardMaterial metalness={1} roughness={0.05} color="#ffffff" />
                </mesh>
             ) : null
          ))}
        </group>
        </Trail>
      </RigidBody>

      <instancedMesh ref={chainInstancedMesh} args={[chainGeo, chainMat, 150]} castShadow={false} frustumCulled={false} />
    </>
  );
};
