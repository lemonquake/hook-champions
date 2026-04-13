import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls, Trail } from '@react-three/drei';
import { RigidBody, RapierRigidBody, useRapier, interactionGroups, CapsuleCollider, BallCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { CharacterModel, CharacterActionState } from './CharacterModel';

const HOOK_COOLDOWN = 2; // seconds
const HOOK_DAMAGE = 50;
const PUSH_HOOK_COOLDOWN = 2; // seconds
const PUSH_FORCE = 30; // violently push them away!

// Pre-allocated memory for zero-allocation chain rendering
const chainDummy = new THREE.Object3D();
const chainUp = new THREE.Vector3(0, 1, 0);
const chainMidPoint = new THREE.Vector3();
const chainCurve = new THREE.QuadraticBezierCurve3();
const chainPos = new THREE.Vector3();
const chainTangent = new THREE.Vector3();
const chainAxis = new THREE.Vector3();

// Push hook chain (separate pre-allocated)
const pushChainDummy = new THREE.Object3D();
const pushChainMidPoint = new THREE.Vector3();
const pushChainCurve = new THREE.QuadraticBezierCurve3();
const pushChainPos = new THREE.Vector3();
const pushChainTangent = new THREE.Vector3();
const pushChainAxis = new THREE.Vector3();

// Pre-allocated reusable objects for per-frame calculations
const _raycaster = new THREE.Raycaster();
const _screenCenter = new THREE.Vector2(0, 0);
const _moveDir = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _xAxis = new THREE.Vector3(1, 0, 0);
const _lookDir = new THREE.Vector3();
const _cameraOffset = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _targetCameraPos = new THREE.Vector3();
const _lookAtPos = new THREE.Vector3();
const _aimOrigin = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _pPos = new THREE.Vector3();
const _hPos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _newPos = new THREE.Vector3();
const _inwardDir = new THREE.Vector3();
const _phPos = new THREE.Vector3();

export const Player: React.FC = () => {
  const playerRef = useRef<RapierRigidBody>(null);
  const hookRef = useRef<RapierRigidBody>(null);
  const chainInstancedMesh = useRef<THREE.InstancedMesh>(null);
  const hookTipRef = useRef<THREE.Group>(null);
  
  // Push hook refs
  const pushHookRef = useRef<RapierRigidBody>(null);
  const pushChainInstancedMesh = useRef<THREE.InstancedMesh>(null);
  const pushHookTipRef = useRef<THREE.Group>(null);
  
  const [, getKeys] = useKeyboardControls();
  const { camera, scene } = useThree();
  const { world, rapier } = useRapier();
  
  const yaw = useRef(0);
  const pitch = useRef(0);
  const cameraShake = useRef(0);
  const lastBroadcastTime = useRef(0);
  const lastTargetCheck = useRef(0);
  
  const actionStateRef = useRef<CharacterActionState>('idle');
  const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const isGrounded = useRef(false);
  const wasGrounded = useRef(false);
  const lastDustTime = useRef(0);
  const groundContactCount = useRef(0);
  
  const canDoubleJump = useRef(false);
  const lastJumpPressed = useRef(false);
  const landingTimer = useRef(0);
  const doubleJumpAnimTimer = useRef(0);
  
  const hookState = useRef({
    status: 'idle' as 'idle' | 'firing' | 'retracting',
    attachedEnemy: null as string | null,
    attachedEnemyHandle: null as number | null,
    lastFireTime: 0,
  });

  const pushHookState = useRef({
    status: 'idle' as 'idle' | 'firing' | 'retracting',
    lastFireTime: 0,
  });

  const { hookTip, chainLink, playerTeamId } = useGameStore();

  const chainGeo = useMemo(() => {
    switch(chainLink) {
      case 'box': return new THREE.BoxGeometry(0.2, 0.1, 0.4);
      case 'cylinder': return new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
      case 'ring': return new THREE.TorusGeometry(0.2, 0.02, 16, 32);
      case 'chainmail': return new THREE.TorusKnotGeometry(0.15, 0.04, 64, 8);
      case 'dna': return new THREE.OctahedronGeometry(0.15);
      case 'hex': return new THREE.CylinderGeometry(0.15, 0.15, 0.3, 6);
      case 'spike': return new THREE.ConeGeometry(0.1, 0.4, 4);
      case 'skull': return new THREE.IcosahedronGeometry(0.15, 0);
      case 'crystal': return new THREE.OctahedronGeometry(0.15, 0);
      case 'gear': return new THREE.CylinderGeometry(0.15, 0.15, 0.1, 12);
      case 'orb': return new THREE.SphereGeometry(0.15, 16, 16);
      case 'diamond': return new THREE.ConeGeometry(0.15, 0.4, 4);
      case 'torus': 
      default: return new THREE.TorusGeometry(0.15, 0.06, 8, 16);
    }
  }, [chainLink]);

  const [chainMat] = useState(() => new THREE.MeshStandardMaterial({ 
    color: '#e2e8f0', 
    metalness: 1, 
    roughness: 0.2,
    emissive: '#0ea5e9',
    emissiveIntensity: 0.8
  }));

  // Push hook chain material — distinct magenta/purple color
  const pushChainGeo = useMemo(() => new THREE.OctahedronGeometry(0.12), []);
  const [pushChainMat] = useState(() => new THREE.MeshStandardMaterial({ 
    color: '#d946ef', 
    metalness: 1, 
    roughness: 0.15,
    emissive: '#a855f7',
    emissiveIntensity: 1.2
  }));

  const teamColor = useGameStore(state => state.teams.find(t => t.id === playerTeamId)?.color || '#22d3ee');

  // Mouse Look
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        yaw.current -= e.movementX * 0.002;
        pitch.current -= e.movementY * 0.002;
        // Clamp pitch
        pitch.current = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch.current));
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);



  // Helper: compute aim target from crosshair
  const getAimData = () => {
    if (!playerRef.current) return null;
    const playerPos = playerRef.current.translation();
    
    _raycaster.setFromCamera(_screenCenter, camera);
    
    const rayOrigin = _raycaster.ray.origin;
    const rayDir = _raycaster.ray.direction;
    
    const rapierRay = new rapier.Ray({ x: rayOrigin.x, y: rayOrigin.y, z: rayOrigin.z }, { x: rayDir.x, y: rayDir.y, z: rayDir.z });
    const hit = world.castRay(rapierRay, 300, true, interactionGroups(1, [0, 1]));
    
    let targetPoint;
    if (hit) {
      const rawHit = hit as any;
      const distance = typeof rawHit.timeOfImpact === 'number' ? rawHit.timeOfImpact : 
                     (typeof rawHit.toi === 'function' ? rawHit.toi() : rawHit.toi);
                     
      if (distance !== undefined && !isNaN(distance)) {
        targetPoint = _raycaster.ray.at(distance, new THREE.Vector3());
      } else {
        targetPoint = _raycaster.ray.origin.clone().add(_raycaster.ray.direction.multiplyScalar(200));
      }
    } else {
      targetPoint = _raycaster.ray.origin.clone().add(_raycaster.ray.direction.multiplyScalar(200));
    }

    const visualOrigin = new THREE.Vector3(playerPos.x, playerPos.y + 1.0, playerPos.z);
    let aimDir = targetPoint.clone().sub(visualOrigin).normalize();
    if (aimDir.lengthSq() < 0.1 || isNaN(aimDir.x)) {
      aimDir = _raycaster.ray.direction.clone().normalize();
    }
    const origin = visualOrigin.add(aimDir.clone().multiplyScalar(0.75));
    
    return { origin, aimDir };
  };

  // Fire Hook (Left Click) & Push Hook (Right Click)
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!document.pointerLockElement) {
        document.body.requestPointerLock();
        return;
      }
      
      const { status } = useGameStore.getState();
      if (status === 'dead') return;
      
      const now = performance.now() / 1000;
      const isBeingHooked = playerRef.current && playerRef.current.bodyType() === rapier.RigidBodyType.KinematicPositionBased;
      
      // === LEFT CLICK: Regular Hook ===
      if (e.button === 0) {
        const hookPenalty = useGameStore.getState().hookPenalties['player'] || 0;
        const penaltyCooldownRemaining = Math.max(0, HOOK_COOLDOWN - (now - hookPenalty));
        if (
          hookState.current.status === 'idle' && 
          now - hookState.current.lastFireTime > HOOK_COOLDOWN &&
          penaltyCooldownRemaining <= 0 &&
          playerRef.current && 
          !isBeingHooked &&
          hookRef.current
        ) {
          hookState.current.lastFireTime = now;
          hookState.current.status = 'firing';
          hookState.current.attachedEnemy = null;
          hookState.current.attachedEnemyHandle = null;
          
          useGameStore.getState().recordShot('player', false);
          
          const aimData = getAimData();
          if (aimData) {
            const hookSpeed = useGameStore.getState().hookSpeed;
            hookRef.current.setBodyType(rapier.RigidBodyType.Dynamic, true);
            hookRef.current.setTranslation({ x: aimData.origin.x, y: aimData.origin.y, z: aimData.origin.z }, true);
            const aimVel = aimData.aimDir.multiplyScalar(hookSpeed);
            hookRef.current.setLinvel({ x: (aimVel.x) || 0, y: (aimVel.y) || 0, z: (aimVel.z) || 0 }, true);
          }
        }
      }
      
      // === RIGHT CLICK: Push Hook ===
      if (e.button === 2) {
        if (
          pushHookState.current.status === 'idle' && 
          now - pushHookState.current.lastFireTime > PUSH_HOOK_COOLDOWN &&
          playerRef.current && 
          !isBeingHooked &&
          pushHookRef.current
        ) {
          pushHookState.current.lastFireTime = now;
          pushHookState.current.status = 'firing';
          
          const aimData = getAimData();
          if (aimData) {
            const hookSpeed = useGameStore.getState().hookSpeed;
            pushHookRef.current.setBodyType(rapier.RigidBodyType.Dynamic, true);
            pushHookRef.current.setTranslation({ x: aimData.origin.x, y: aimData.origin.y, z: aimData.origin.z }, true);
            const pAimVel = aimData.aimDir.multiplyScalar(hookSpeed * 1.2);
            pushHookRef.current.setLinvel({ x: (pAimVel.x) || 0, y: (pAimVel.y) || 0, z: (pAimVel.z) || 0 }, true);
          }
        }
      }
    };
    
    // Prevent context menu on right click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [camera, world, rapier]);

  useFrame((state, delta) => {
    if (!playerRef.current || !hookRef.current || !pushHookRef.current) return;

    const storeState = useGameStore.getState();
    const { moveSpeed, status, hookSpeed, retractSpeed, maxHookLength } = storeState;
    const playerMaimed = storeState.isMaimed('player');
    const effectiveMoveSpeed = playerMaimed ? moveSpeed * 0.5 : moveSpeed;
    
    if (status === 'dead') {
      playerRef.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
      playerRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      
      actionStateRef.current = 'dead';
      hookState.current.status = 'idle';
      hookState.current.attachedEnemy = null;
      hookState.current.attachedEnemyHandle = null;
      return;
    }

    const myPos = playerRef.current.translation();
    _pPos.set(myPos.x, myPos.y, myPos.z);
    
    // update storePos without allocating
    const [sx, sy, sz] = storeState.playerPosition;
    _newPos.set(sx, sy, sz);
    
    // --- Teleport Check (Respawn) ---
    if (_pPos.distanceTo(_newPos) > 10) {
      playerRef.current.setTranslation({ x: _newPos.x, y: _newPos.y, z: _newPos.z }, true);
      playerRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      hookState.current.status = 'idle';
      hookState.current.attachedEnemy = null;
      hookState.current.attachedEnemyHandle = null;
      return;
    }
    
    // --- Player Movement ---
    const { forward, backward, left, right } = getKeys();
    _moveDir.set(
      (right ? 1 : 0) - (left ? 1 : 0),
      0,
      (backward ? 1 : 0) - (forward ? 1 : 0)
    ).normalize();

    // Apply yaw to movement direction
    _moveDir.applyAxisAngle(_yAxis, yaw.current);
    _moveDir.multiplyScalar(effectiveMoveSpeed);

    const linVel = playerRef.current.linvel();
    velocityRef.current.set(_moveDir.x, linVel.y, _moveDir.z);

    // --- Ground Check (collision-event based + velocity fallback) ---
    wasGrounded.current = isGrounded.current;
    // Primary: collision event counter (set via onCollisionEnter/Exit on RigidBody)
    // Fallback: if vertical velocity is near zero and player is near ground level
    const velThreshold = Math.abs(linVel.y) < 2.0;
    const posThreshold = myPos.y < 3.0; // anywhere near walkable terrain
    isGrounded.current = groundContactCount.current > 0 || (velThreshold && posThreshold);

    if (isGrounded.current && !wasGrounded.current) {
      canDoubleJump.current = true;
      doubleJumpAnimTimer.current = 0; // stop flip if landed
      if (linVel.y < -5) {
        landingTimer.current = 0.25; // 250ms land anim
      }
    } else if (!isGrounded.current && wasGrounded.current) {
      canDoubleJump.current = true; // walked off edge, can jump
    }

    if (landingTimer.current > 0) landingTimer.current -= delta;
    if (doubleJumpAnimTimer.current > 0) doubleJumpAnimTimer.current -= delta;

    // --- Jump ---
    const keys = getKeys();
    const jump = (keys as any).jump;
    let newVelocityY = linVel.y;
    const isBeingHooked = playerRef.current.bodyType() === rapier.RigidBodyType.KinematicPositionBased;

    if (jump && !lastJumpPressed.current && !isBeingHooked && !playerMaimed) {
      if (isGrounded.current) {
        newVelocityY = 7;
        isGrounded.current = false;
        groundContactCount.current = 0; // Force airborne
      } else if (canDoubleJump.current) {
        newVelocityY = 5;
        canDoubleJump.current = false;
        doubleJumpAnimTimer.current = 0.5;
      }
    }
    lastJumpPressed.current = jump;

    // --- Hazard & Pitfall Logic ---
    let extraForceX = 0;
    let extraForceZ = 0;
    
    if (storeState.mapConfig.theme === 'Volcano') {
      if (myPos.y < -1.0) {
        // Lava DOT
        useGameStore.getState().damagePlayer(50 * delta, 'hazard');
      }
    } else {
      // Blades trap
      if (myPos.y < -12) {
        useGameStore.getState().damagePlayer(9999, 'hazard'); // Instant death
        useGameStore.getState().spawnEffect('blood_explosion', [myPos.x, -12, myPos.z], '#991b1b');
      } else if (myPos.y < -2 && !isGrounded.current) {
        // "Suck in" vacuum mechanics to ensure they die when they fall
        newVelocityY -= 30 * delta; // Extra brutal gravity pull
        
        // Pull inwards toward center of the blades
        _inwardDir.set(-myPos.x, 0, -myPos.z).normalize();
        extraForceX = _inwardDir.x * 10;
        extraForceZ = _inwardDir.z * 10;
      }
    }

    // Keep current Y velocity for gravity/falling
    if (!isBeingHooked) {
      if (playerMaimed) {
        const currentVel = playerRef.current.linvel();
        const drag = isGrounded.current ? 30 * delta : 10 * delta;
        const newVelX = Math.abs(currentVel.x) > drag ? currentVel.x - Math.sign(currentVel.x)*drag : 0;
        const newVelZ = Math.abs(currentVel.z) > drag ? currentVel.z - Math.sign(currentVel.z)*drag : 0;
        playerRef.current.setLinvel({ x: (newVelX + extraForceX) || 0, y: (newVelocityY) || 0, z: (newVelZ + extraForceZ) || 0 }, true);
      } else {
        playerRef.current.setLinvel({ x: (_moveDir.x + extraForceX) || 0, y: (newVelocityY) || 0, z: (_moveDir.z + extraForceZ) || 0 }, true);
      }
    } else {
      velocityRef.current.set(0, 0, 0);
    }

    // Update Action State
    if (isBeingHooked) {
      actionStateRef.current = 'hooked';
    } else if (hookState.current.status === 'retracting' && hookState.current.attachedEnemy) {
      actionStateRef.current = 'shoot';
      // Dust if moving fast
      if (isGrounded.current && state.clock.elapsedTime - lastDustTime.current > 0.1 && linVel.x*linVel.x + linVel.z*linVel.z > 5) {
        lastDustTime.current = state.clock.elapsedTime;
        useGameStore.getState().spawnEffect('dust', [myPos.x, myPos.y, myPos.z], '#64748b');
      }
    } else if (hookState.current.status === 'firing') {
      actionStateRef.current = 'shoot';
    } else if (landingTimer.current > 0) {
      actionStateRef.current = 'land';
    } else if (doubleJumpAnimTimer.current > 0) {
      actionStateRef.current = 'doubleJump';
    } else if (!isGrounded.current) {
      actionStateRef.current = linVel.y > 0 ? 'jump' : 'fall';
    } else if (_moveDir.lengthSq() > 0.1) {
      actionStateRef.current = 'walk';
    } else {
      actionStateRef.current = 'idle';
    }

    // Rotate player to face camera yaw
    _targetQuat.setFromAxisAngle(_yAxis, yaw.current);
    playerRef.current.setRotation(_targetQuat, true);

    // --- Camera Positioning (3rd Person) ---
    const playerPos = playerRef.current.translation();
    
    // Update store position and velocity
    const linVel2 = playerRef.current.linvel();
    useGameStore.getState().setStats({ 
      playerPosition: [playerPos.x, playerPos.y, playerPos.z],
      playerVelocity: [linVel2.x, linVel2.y, linVel2.z]
    });
    
    if (state.clock.elapsedTime - lastBroadcastTime.current > 0.05) { // 20 fps
      lastBroadcastTime.current = state.clock.elapsedTime;
      useGameStore.getState().broadcastState({
        position: [playerPos.x, playerPos.y, playerPos.z],
        rotation: [_targetQuat.x, _targetQuat.y, _targetQuat.z, _targetQuat.w],
        teamId: playerTeamId,
        status: status,
        hookStatus: hookState.current.status,
        hookPos: [hookRef.current.translation().x, hookRef.current.translation().y, hookRef.current.translation().z]
      });
    }
    
    // The camera should be offset to the right and back from the player.
    _cameraOffset.set(1.0, 0.5, 3.5); // Right, up, back
    _cameraOffset.applyAxisAngle(_xAxis, pitch.current);
    _cameraOffset.applyAxisAngle(_yAxis, yaw.current);
    
    // We want the camera to look forward.
    _lookDir.set(0, 0, -1);
    _lookDir.applyAxisAngle(_xAxis, pitch.current);
    _lookDir.applyAxisAngle(_yAxis, yaw.current);

    _targetCameraPos.set(playerPos.x, playerPos.y + 1.5, playerPos.z).add(_cameraOffset);
    camera.position.lerp(_targetCameraPos, 0.5);
    
    // --- Camera Shake & FOV Warp ---
    if (cameraShake.current > 0) {
      camera.position.x += (Math.random() - 0.5) * cameraShake.current;
      camera.position.y += (Math.random() - 0.5) * cameraShake.current;
      camera.position.z += (Math.random() - 0.5) * cameraShake.current;
      cameraShake.current *= 0.8;
      if (cameraShake.current < 0.01) cameraShake.current = 0;
    }

    if (hookState.current.status === 'retracting' && hookState.current.attachedEnemy) {
      (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp((camera as THREE.PerspectiveCamera).fov, 95, 0.1);
    } else {
      (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp((camera as THREE.PerspectiveCamera).fov, 75, 0.1);
    }
    camera.updateProjectionMatrix();

    _lookAtPos.copy(camera.position).add(_lookDir);
    camera.lookAt(_lookAtPos);

    // --- Crosshair Detection ---
    if (state.clock.elapsedTime - lastTargetCheck.current > 0.05) {
      lastTargetCheck.current = state.clock.elapsedTime;
      _raycaster.setFromCamera(_screenCenter, camera);
      const rapierRay = new rapier.Ray({ x: _raycaster.ray.origin.x, y: _raycaster.ray.origin.y, z: _raycaster.ray.origin.z }, { x: _raycaster.ray.direction.x, y: _raycaster.ray.direction.y, z: _raycaster.ray.direction.z });
      const hit = world.castRay(rapierRay, maxHookLength, true, interactionGroups(1, [0, 1]));
      let hasTarget = false;
      if (hit && hit.collider) {
        const parent = hit.collider.parent();
        // Dynamic bodies or kinematic bodies usually imply enemy/player, but ensure it's not our own player body
        if (parent && parent.bodyType() !== rapier.RigidBodyType.Fixed && parent.handle !== playerRef.current.handle) {
          hasTarget = true;
        }
      }
      if (storeState.crosshairTargetLock !== hasTarget) {
        useGameStore.getState().setCrosshairTargetLock(hasTarget);
      }
    }

    // --- Hook Logic ---
    const hookPos = hookRef.current.translation();
    _pPos.set(myPos.x, myPos.y + 1, myPos.z);
    _hPos.set(hookPos.x, hookPos.y, hookPos.z);
    const dist = _pPos.distanceTo(_hPos);

    // Update UI Store
    const now = performance.now() / 1000;
    const hookPenalty = useGameStore.getState().hookPenalties['player'] || 0;
    const cooldownFromFire = Math.max(0, HOOK_COOLDOWN - (now - hookState.current.lastFireTime));
    const cooldownFromPenalty = Math.max(0, HOOK_COOLDOWN - (now - hookPenalty));
    const cooldownRemaining = Math.max(cooldownFromFire, cooldownFromPenalty);
    
    // Push hook cooldown
    const pushCooldownRemaining = pushHookState.current.status === 'idle' 
      ? Math.max(0, PUSH_HOOK_COOLDOWN - (now - pushHookState.current.lastFireTime))
      : PUSH_HOOK_COOLDOWN; // While active, show full cooldown
    
    useGameStore.getState().setStats({ 
      cooldown: cooldownRemaining,
      pushHookCooldown: pushCooldownRemaining,
      hookLength: hookState.current.status === 'idle' ? 0 : Math.round(dist)
    });

    if (hookTipRef.current) {
      hookTipRef.current.visible = hookState.current.status !== 'idle';
    }

    if (hookState.current.status === 'idle') {
      // Hide hook far away
      if (hookRef.current.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) {
        hookRef.current.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      }
      hookRef.current.setNextKinematicTranslation({ x: 0, y: (-1000) || 0, z: 0 });
      if (chainInstancedMesh.current) chainInstancedMesh.current.count = 0;
    } 
    else if (hookState.current.status === 'firing') {
      // Spin shuriken
      if (hookTipRef.current) {
        hookTipRef.current.rotation.y += delta * 30;
        hookTipRef.current.rotation.x += delta * 15;
      }

      const timeAlive = now - hookState.current.lastFireTime;
      if (dist > maxHookLength || timeAlive > 2.0) {
        hookState.current.status = 'retracting';
      }
    } 
    else if (hookState.current.status === 'retracting') {
      if (hookRef.current.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) {
        hookRef.current.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      }

      // Constant-speed retraction — never slowed down by anything
      _dir.copy(_pPos).sub(_hPos);
      const distanceToPlayer = _dir.length();
      const step = retractSpeed * delta;
      
      if (step >= distanceToPlayer) {
        _newPos.copy(_pPos);
      } else {
        _newPos.copy(_hPos).add(_dir.normalize().multiplyScalar(step));
      }
      hookRef.current.setNextKinematicTranslation({ x: (_newPos.x) || 0, y: (_newPos.y) || 0, z: (_newPos.z) || 0 });

      // Spin shuriken reverse
      if (hookTipRef.current) {
        hookTipRef.current.rotation.y -= delta * 30;
        hookTipRef.current.rotation.x -= delta * 15;
      }

      // Pull attached enemy
      if (hookState.current.attachedEnemyHandle !== null) {
        const enemyBody = world.getRigidBody(hookState.current.attachedEnemyHandle);
        if (enemyBody) {
          if (enemyBody.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) {
            enemyBody.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
          }
          enemyBody.setNextKinematicTranslation({ x: _newPos.x, y: Math.max(1, _newPos.y - 1), z: _newPos.z });
        }
      }

      if (dist < 2 || distanceToPlayer < step) {
        // Reached player
        hookState.current.status = 'idle';
        // Cooldown starts NOW (on arrival), not when fired
        hookState.current.lastFireTime = performance.now() / 1000;
        
        if (hookState.current.attachedEnemy) {
          // Damage only if not teammate
          const enemyData = useGameStore.getState().enemies[hookState.current.attachedEnemy];
          if (enemyData && enemyData.teamId !== useGameStore.getState().playerTeamId) {
            useGameStore.getState().damageEnemy(hookState.current.attachedEnemy, HOOK_DAMAGE, 'player');
            useGameStore.getState().recordShot('player', true); // Record hit
            useGameStore.getState().spawnEffect('impact', [enemyData.position[0], enemyData.position[1], enemyData.position[2]], '#ef4444');
          }
          
          // Apply hook penalty to the snagged enemy (their hook goes on cooldown)
          useGameStore.getState().applyHookPenalty(hookState.current.attachedEnemy);
          
          if (hookState.current.attachedEnemyHandle !== null) {
            const enemyBody = world.getRigidBody(hookState.current.attachedEnemyHandle);
            if (enemyBody) {
              enemyBody.setBodyType(rapier.RigidBodyType.Dynamic, true);
            }
          }
          
          hookState.current.attachedEnemy = null;
          hookState.current.attachedEnemyHandle = null;
        }
      }
    }

    // --- Draw Chain ---
    if (chainInstancedMesh.current && hookState.current.status !== 'idle') {
      const linkLength = chainLink === 'box' ? 0.4 : chainLink === 'cylinder' ? 0.4 : 0.4;
      const numLinks = Math.min(150, Math.floor(dist / linkLength));
      chainInstancedMesh.current.count = numLinks;
      
      chainMidPoint.addVectors(_pPos, _hPos).multiplyScalar(0.5);
      const droopAmount = hookState.current.status === 'retracting' && hookState.current.attachedEnemy ? 0.2 : Math.min(dist * 0.2, 2.0);
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

    // ═══════════════════════════════════════════════════════
    // ═══  PUSH HOOK LOGIC  ═══════════════════════════════
    // ═══════════════════════════════════════════════════════
    const pushHookPos = pushHookRef.current.translation();
    _phPos.set(pushHookPos.x, pushHookPos.y, pushHookPos.z);
    const pushDist = _pPos.distanceTo(_phPos);

    if (pushHookTipRef.current) {
      pushHookTipRef.current.visible = pushHookState.current.status !== 'idle';
    }

    if (pushHookState.current.status === 'idle') {
      if (pushHookRef.current.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) {
        pushHookRef.current.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      }
      pushHookRef.current.setNextKinematicTranslation({ x: 0, y: (-1000) || 0, z: 0 });
      if (pushChainInstancedMesh.current) pushChainInstancedMesh.current.count = 0;
    } 
    else if (pushHookState.current.status === 'firing') {
      // Spin the concussion fist
      if (pushHookTipRef.current) {
        pushHookTipRef.current.rotation.y -= delta * 25;
        pushHookTipRef.current.rotation.z += delta * 20;
      }

      const timeAlive = now - pushHookState.current.lastFireTime;
      if (pushDist > maxHookLength || timeAlive > 2.0) {
        pushHookState.current.status = 'retracting';
      }
    } 
    else if (pushHookState.current.status === 'retracting') {
      if (pushHookRef.current.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) {
        pushHookRef.current.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      }

      _dir.copy(_pPos).sub(_phPos);
      const distanceToPlayer = _dir.length();
      const step = retractSpeed * 1.5 * delta;
      
      if (step >= distanceToPlayer) {
        _newPos.copy(_pPos);
      } else {
        _newPos.copy(_phPos).add(_dir.normalize().multiplyScalar(step));
      }
      pushHookRef.current.setNextKinematicTranslation({ x: (_newPos.x) || 0, y: (_newPos.y) || 0, z: (_newPos.z) || 0 });

      if (pushHookTipRef.current) {
        pushHookTipRef.current.rotation.y += delta * 25;
        pushHookTipRef.current.rotation.z -= delta * 20;
      }

      if (pushDist < 2 || distanceToPlayer < step) {
        pushHookState.current.status = 'idle';
        pushHookState.current.lastFireTime = performance.now() / 1000;
      }
    }

    // --- Draw Push Hook Chain ---
    if (pushChainInstancedMesh.current && pushHookState.current.status !== 'idle') {
      const linkLength = 0.35;
      const numLinks = Math.min(150, Math.floor(pushDist / linkLength));
      pushChainInstancedMesh.current.count = numLinks;
      
      pushChainMidPoint.addVectors(_pPos, _phPos).multiplyScalar(0.5);
      const droopAmount = pushHookState.current.status === 'retracting' ? 0.1 : Math.min(pushDist * 0.15, 1.5);
      pushChainMidPoint.y -= droopAmount;
      
      pushChainCurve.v0.copy(_pPos);
      pushChainCurve.v1.copy(pushChainMidPoint);
      pushChainCurve.v2.copy(_phPos);

      for (let i = 0; i < numLinks; i++) {
        const t = i / (numLinks - 1 || 1);
        pushChainCurve.getPoint(t, pushChainPos);
        pushChainCurve.getTangent(t, pushChainTangent);

        pushChainDummy.position.copy(pushChainPos);
        
        pushChainAxis.crossVectors(chainUp, pushChainTangent).normalize();
        const radians = Math.acos(Math.max(-1, Math.min(1, chainUp.dot(pushChainTangent))));
        pushChainDummy.quaternion.setFromAxisAngle(pushChainAxis, radians);
        
        pushChainDummy.rotateX(Math.PI / 2);
        if (i % 2 === 0) pushChainDummy.rotateY(Math.PI / 4);
        
        pushChainDummy.updateMatrix();
        pushChainInstancedMesh.current.setMatrixAt(i, pushChainDummy.matrix);
      }
      pushChainInstancedMesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Player Body */}
      <RigidBody 
        ref={playerRef} 
        colliders={false} 
        mass={1} 
        type="dynamic" 
        position={[0, 5, 0]} 
        enabledRotations={[false, false, false]}
        name="player"
        collisionGroups={interactionGroups(1, [0, 1, 2])}
        onCollisionEnter={(e) => {
          // Count contacts with ground/static objects for grounding
          const otherBody = e.other.rigidBody;
          if (otherBody && otherBody.bodyType() === rapier.RigidBodyType.Fixed) {
            groundContactCount.current++;
          }
        }}
        onCollisionExit={(e) => {
          const otherBody = e.other.rigidBody;
          if (otherBody && otherBody.bodyType() === rapier.RigidBodyType.Fixed) {
            groundContactCount.current = Math.max(0, groundContactCount.current - 1);
          }
        }}
      >
        <CapsuleCollider args={[0.5, 0.5]} position={[0, 1, 0]} />
        <CharacterModel actionStateRef={actionStateRef} velocityRef={velocityRef} teamColor={teamColor} />
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
          
          if (name === 'player') return; // Prevent snagging on self
          
          if (name && (name.startsWith('enemy') || name.startsWith('bot'))) {
            hookState.current.status = 'retracting'; // Only retract on valid targets (hit an enemy)
            hookState.current.attachedEnemy = name;
            
            useGameStore.getState().applyMaim(name);
            useGameStore.getState().applyPushCredit(name, 'player');
            
            cameraShake.current = 0.4; // Big impact shake
            // Effects
            const ep = e.other.rigidBody?.translation();
            if (ep) useGameStore.getState().spawnEffect('impact', [ep.x, ep.y, ep.z], '#eab308');
            
            const enemyBody = e.other.rigidBody;
            if (enemyBody) {
              hookState.current.attachedEnemyHandle = enemyBody.handle;
            }
          } else {
            cameraShake.current = 0.15; // Small shake for wall bounce
            const pos = hookRef.current.translation();
            useGameStore.getState().spawnEffect('impact', [pos.x, pos.y, pos.z], '#94a3b8');
          }
        }}
      >
        <BallCollider args={[0.3]} />
        <Trail width={1.5} length={20} color={teamColor} attenuation={(t) => t * t}>
          <group ref={hookTipRef}>
          {hookTip === 'shuriken' && (
            <>
              <mesh castShadow>
                <cylinderGeometry args={[0.3, 0.3, 0.15, 16]} />
                <meshStandardMaterial metalness={1} roughness={0.05} color="#ffffff" />
              </mesh>
              {[0, 1, 2, 3].map((i) => (
                <mesh 
                  key={i} 
                  position={[Math.cos(i * Math.PI/2) * 0.4, 0, Math.sin(i * Math.PI/2) * 0.4]} 
                  rotation={[0, -i * Math.PI/2, -Math.PI/2]} 
                  castShadow
                >
                  <coneGeometry args={[0.15, 0.6, 4]} />
                  <meshStandardMaterial metalness={1} roughness={0.05} color="#ffffff" />
                </mesh>
              ))}
            </>
          )}
          {hookTip === 'anchor' && (
            <>
              <mesh castShadow position={[0, 0, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#94a3b8" />
              </mesh>
              <mesh castShadow position={[0, -0.4, 0]} rotation={[0, 0, Math.PI/2]}>
                <torusGeometry args={[0.4, 0.1, 8, 16, Math.PI]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#94a3b8" />
              </mesh>
              <mesh castShadow position={[0.4, -0.4, 0]} rotation={[0, 0, Math.PI/4]}>
                <coneGeometry args={[0.15, 0.3, 4]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#94a3b8" />
              </mesh>
              <mesh castShadow position={[-0.4, -0.4, 0]} rotation={[0, 0, -Math.PI/4]}>
                <coneGeometry args={[0.15, 0.3, 4]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#94a3b8" />
              </mesh>
            </>
          )}
          {hookTip === 'scythe' && (
            <>
              <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.1} color="#1e293b" />
              </mesh>
              <mesh castShadow position={[0.3, 0, 0.4]} rotation={[0, Math.PI/2, 0]}>
                <boxGeometry args={[0.8, 0.05, 0.2]} />
                <meshStandardMaterial metalness={1} roughness={0.1} color="#ef4444" />
              </mesh>
              <mesh castShadow position={[0.6, 0, 0.7]} rotation={[0, Math.PI/4, 0]}>
                <coneGeometry args={[0.1, 0.4, 4]} />
                <meshStandardMaterial metalness={1} roughness={0.1} color="#ef4444" />
              </mesh>
            </>
          )}
          {hookTip === 'trident' && (
            <>
              <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#0284c7" />
              </mesh>
              <mesh castShadow position={[0, 0, 0.5]} rotation={[Math.PI/2, 0, 0]}>
                <coneGeometry args={[0.1, 0.4, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#0284c7" />
              </mesh>
              <mesh castShadow position={[0.3, 0, 0.2]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#0284c7" />
              </mesh>
              <mesh castShadow position={[0.3, 0, 0.5]} rotation={[Math.PI/2, 0, 0]}>
                <coneGeometry args={[0.08, 0.3, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#0284c7" />
              </mesh>
              <mesh castShadow position={[-0.3, 0, 0.2]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#0284c7" />
              </mesh>
              <mesh castShadow position={[-0.3, 0, 0.5]} rotation={[Math.PI/2, 0, 0]}>
                <coneGeometry args={[0.08, 0.3, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#0284c7" />
              </mesh>
            </>
          )}
          {hookTip === 'harpoon' && (
            <>
              <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#475569" />
              </mesh>
              <mesh castShadow position={[0, 0, 0.6]} rotation={[Math.PI/2, 0, 0]}>
                <coneGeometry args={[0.15, 0.5, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#475569" />
              </mesh>
              <mesh castShadow position={[0.15, 0, 0.4]} rotation={[0, 0, -Math.PI/4]}>
                <coneGeometry args={[0.1, 0.3, 4]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#475569" />
              </mesh>
            </>
          )}
          {hookTip === 'dagger' && (
            <>
              <mesh castShadow position={[0, 0, -0.2]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.5, 8]} />
                <meshStandardMaterial metalness={0.5} roughness={0.8} color="#8b4513" />
              </mesh>
              <mesh castShadow position={[0, 0, 0.1]} rotation={[Math.PI/2, 0, 0]}>
                <boxGeometry args={[0.4, 0.05, 0.1]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#d4d4d8" />
              </mesh>
              <mesh castShadow position={[0, 0, 0.4]} rotation={[Math.PI/2, 0, 0]}>
                <coneGeometry args={[0.15, 0.6, 4]} />
                <meshStandardMaterial metalness={1} roughness={0.1} color="#e4e4e7" />
              </mesh>
            </>
          )}
          {hookTip === 'claw' && (
            <>
              <mesh castShadow position={[0, 0, 0]}>
                <sphereGeometry args={[0.2, 16, 16]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#52525b" />
              </mesh>
              {[0, 1, 2].map(i => (
                <mesh key={i} castShadow position={[Math.cos(i*Math.PI*2/3)*0.2, Math.sin(i*Math.PI*2/3)*0.2, 0.2]} rotation={[0, 0, i*Math.PI*2/3]}>
                  <coneGeometry args={[0.08, 0.5, 8]} />
                  <meshStandardMaterial metalness={1} roughness={0.2} color="#71717a" />
                </mesh>
              ))}
            </>
          )}
          {hookTip === 'drill' && (
            <>
              <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.4, 16]} />
                <meshStandardMaterial metalness={1} roughness={0.3} color="#f59e0b" />
              </mesh>
              <mesh castShadow position={[0, 0, 0.5]} rotation={[Math.PI/2, 0, 0]}>
                <coneGeometry args={[0.2, 0.8, 16]} />
                <meshStandardMaterial metalness={1} roughness={0.3} color="#b45309" />
              </mesh>
            </>
          )}
          {hookTip === 'star' && (
            <>
              <mesh castShadow>
                <sphereGeometry args={[0.2, 16, 16]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#a1a1aa" />
              </mesh>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <mesh key={i} castShadow position={[Math.cos(i*Math.PI/3)*0.25, Math.sin(i*Math.PI/3)*0.25, 0]} rotation={[0, 0, i*Math.PI/3 - Math.PI/2]}>
                  <coneGeometry args={[0.1, 0.4, 8]} />
                  <meshStandardMaterial metalness={1} roughness={0.2} color="#d4d4d8" />
                </mesh>
              ))}
            </>
          )}
          {hookTip === 'arrow' && (
            <>
              <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 1.2, 8]} />
                <meshStandardMaterial metalness={0.2} roughness={0.8} color="#78350f" />
              </mesh>
              <mesh castShadow position={[0, 0, 0.6]} rotation={[Math.PI/2, 0, 0]}>
                <coneGeometry args={[0.1, 0.3, 4]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#94a3b8" />
              </mesh>
              <mesh castShadow position={[0, 0, -0.5]} rotation={[Math.PI/2, 0, 0]}>
                <boxGeometry args={[0.15, 0.2, 0.02]} />
                <meshStandardMaterial metalness={0} roughness={0.9} color="#ef4444" />
              </mesh>
            </>
          )}
          {hookTip === 'crescent' && (
            <>
              <mesh castShadow position={[0, 0, 0]} rotation={[0, Math.PI/2, 0]}>
                <torusGeometry args={[0.4, 0.08, 16, 32, Math.PI]} />
                <meshStandardMaterial metalness={1} roughness={0.1} color="#e0e7ff" />
              </mesh>
              <mesh castShadow position={[0, 0, -0.4]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.8, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.1} color="#4f46e5" />
              </mesh>
            </>
          )}
          {hookTip === 'sawblade' && (
            <>
              <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.4, 0.4, 0.05, 32]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#cbd5e1" />
              </mesh>
              {Array.from({length: 12}).map((_, i) => (
                <mesh key={i} castShadow position={[Math.cos(i*Math.PI/6)*0.45, 0, Math.sin(i*Math.PI/6)*0.45]} rotation={[0, -i*Math.PI/6 + Math.PI/2, 0]}>
                  <coneGeometry args={[0.08, 0.2, 4]} />
                  <meshStandardMaterial metalness={1} roughness={0.2} color="#cbd5e1" />
                </mesh>
              ))}
            </>
          )}
          {hookTip === 'kunai' && (
            <>
              <mesh castShadow position={[0, 0, -0.3]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.6, 8]} />
                <meshStandardMaterial metalness={0.2} roughness={0.4} color="#18181b" />
              </mesh>
              <mesh castShadow position={[0, 0, -0.6]} rotation={[0, Math.PI/2, 0]}>
                <torusGeometry args={[0.06, 0.02, 8, 16]} />
                <meshStandardMaterial metalness={1} roughness={0.2} color="#71717a" />
              </mesh>
              <mesh castShadow position={[0, 0, 0.2]} rotation={[Math.PI/2, 0, 0]}>
                <octahedronGeometry args={[0.15, 0]} />
                <meshStandardMaterial metalness={1} roughness={0.1} color="#e4e4e7" />
              </mesh>
            </>
          )}
          {hookTip === 'golden_dragon' && (
            <>
              <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.12, 1.0, 16]} />
                <meshStandardMaterial metalness={1} roughness={0.1} color="#fbbf24" />
              </mesh>
              <mesh castShadow position={[0, 0, 0.5]} rotation={[Math.PI/2, 0, 0]}>
                <coneGeometry args={[0.2, 0.6, 8]} />
                <meshStandardMaterial metalness={1} roughness={0.1} color="#f59e0b" />
              </mesh>
              {[1, 2, 3].map(i => (
                <mesh key={i} castShadow position={[0, 0, -0.4 + i*0.2]} rotation={[0, 0, i*Math.PI/4]}>
                  <torusGeometry args={[0.15, 0.04, 8, 16]} />
                  <meshStandardMaterial metalness={1} roughness={0.1} color="#fcd34d" />
                </mesh>
              ))}
            </>
          )}
          {hookTip === 'plasma_caster' && (
            <>
              <mesh castShadow position={[0, 0, -0.2]}>
                <boxGeometry args={[0.3, 0.3, 0.6]} />
                <meshStandardMaterial metalness={0.8} roughness={0.2} color="#1e293b" />
              </mesh>
              <mesh castShadow position={[0, 0, 0.3]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 0.6, 16]} />
                <meshStandardMaterial metalness={0.9} roughness={0.1} color="#0f172a" />
              </mesh>
              <mesh position={[0, 0, 0.6]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
                <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={2} />
              </mesh>
            </>
          )}
          {hookTip === 'void_shard' && (
            <>
              <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                <octahedronGeometry args={[0.4, 0]} />
                <meshStandardMaterial color="#1e1b4b" metalness={0.9} roughness={0.1} emissive="#a855f7" emissiveIntensity={0.6} />
              </mesh>
              <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI/4, 0, Math.PI/4]}>
                <octahedronGeometry args={[0.3, 0]} />
                <meshStandardMaterial color="#c026d3" metalness={0.8} roughness={0.2} />
              </mesh>
            </>
          )}
</group>
        </Trail>
      </RigidBody>

      {/* Chain Links */}
      <instancedMesh ref={chainInstancedMesh} args={[chainGeo, chainMat, 150]} castShadow={false} frustumCulled={false} />

      {/* ═══ PUSH HOOK PROJECTILE ═══ */}
      <RigidBody
        ref={pushHookRef}
        type="dynamic"
        colliders={false}
        ccd
        gravityScale={0}
        restitution={0.5}
        friction={0}
        linearDamping={0}
        angularDamping={0}
        position={[0, -1000, 0]}
        collisionGroups={interactionGroups(2, [0, 1])}
        onCollisionEnter={(e) => {
          if (pushHookState.current.status !== 'firing') return;
          
          // @ts-ignore
          const name = e.other.rigidBodyObject?.userData?.name || e.other.rigidBodyObject?.name;
          const otherBody = e.other.rigidBody;
          
          if (name === 'player') return; // Don't push yourself
          
          if (otherBody && otherBody.bodyType() !== rapier.RigidBodyType.Fixed) {
            // Push the target AWAY from the player
            const playerPos = playerRef.current!.translation();
            const ep = otherBody.translation();
            const pushDir = new THREE.Vector3(ep.x - playerPos.x, 0.3, ep.z - playerPos.z).normalize();
            
            // Restore dynamic body type before applying impulse
            setTimeout(() => {
                if (otherBody.bodyType() !== rapier.RigidBodyType.Dynamic) {
                  otherBody.setBodyType(rapier.RigidBodyType.Dynamic, true);
                }
                otherBody.setLinvel({ x: (pushDir.x * PUSH_FORCE) || 0, y: (pushDir.y * PUSH_FORCE * 0.5) || 0, z: (pushDir.z * PUSH_FORCE) || 0 }, true);
            }, 0);
            
            if (name) {
              // Apply maim debuff
              useGameStore.getState().applyMaim(name);
              // Track push credit for kill attribution on hazard death
              useGameStore.getState().applyPushCredit(name, 'player');
            }
            
            // Visual feedback
            useGameStore.getState().spawnEffect('impact', [ep.x, ep.y, ep.z], '#d946ef');
            cameraShake.current = 0.3;
            
            // Start retracting immediately after push
            pushHookState.current.status = 'retracting';
          } else {
            // Hit a wall — bounce effect and retract
            const pos = pushHookRef.current!.translation();
            useGameStore.getState().spawnEffect('impact', [pos.x, pos.y, pos.z], '#a855f7');
            cameraShake.current = 0.1;
            pushHookState.current.status = 'retracting';
          }
        }}
      >
        <BallCollider args={[0.35]} />
        <Trail width={2.0} length={15} color="#d946ef" attenuation={(t) => t * t}>
          <group ref={pushHookTipRef}>
            {/* Core Energy Sphere */}
            <mesh castShadow>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshStandardMaterial 
                color="#d946ef" 
                emissive="#a855f7" 
                emissiveIntensity={3} 
                metalness={0.3} 
                roughness={0.1} 
              />
            </mesh>
            {/* Outer Glow Shell */}
            <mesh>
              <sphereGeometry args={[0.35, 16, 16]} />
              <meshStandardMaterial 
                color="#c026d3" 
                transparent 
                opacity={0.3} 
                emissive="#d946ef" 
                emissiveIntensity={2} 
              />
            </mesh>
            {/* 4 Rotating Knuckle Prongs */}
            {[0, 1, 2, 3].map((i) => (
              <mesh 
                key={i} 
                castShadow
                position={[
                  Math.cos(i * Math.PI/2) * 0.4, 
                  Math.sin(i * Math.PI/2) * 0.4, 
                  0
                ]} 
                rotation={[0, 0, i * Math.PI/2]}
              >
                <octahedronGeometry args={[0.12, 0]} />
                <meshStandardMaterial 
                  color="#e879f9" 
                  metalness={1} 
                  roughness={0.05} 
                  emissive="#d946ef" 
                  emissiveIntensity={1.5} 
                />
              </mesh>
            ))}
            {/* Central Cross Energy Bars */}
            <mesh castShadow rotation={[0, 0, Math.PI/4]}>
              <boxGeometry args={[0.8, 0.06, 0.06]} />
              <meshStandardMaterial color="#f0abfc" emissive="#d946ef" emissiveIntensity={2} />
            </mesh>
            <mesh castShadow rotation={[0, 0, -Math.PI/4]}>
              <boxGeometry args={[0.8, 0.06, 0.06]} />
              <meshStandardMaterial color="#f0abfc" emissive="#d946ef" emissiveIntensity={2} />
            </mesh>
            {/* Point Light for glow */}
            <pointLight color="#d946ef" intensity={8} distance={6} />
          </group>
        </Trail>
      </RigidBody>

      {/* Push Hook Chain Links */}
      <instancedMesh ref={pushChainInstancedMesh} args={[pushChainGeo, pushChainMat, 150]} castShadow={false} frustumCulled={false} />
    </>
  );
};

