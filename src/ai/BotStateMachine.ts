import * as YUKA from 'yuka';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { AITelemetryBrain } from './AITelemetryBrain';

// We create a custom Vehicle to hold bot-specific data needed by states
export class BotEntity extends (YUKA as any).Vehicle {
  botId: string;
  targetPositionHistory: Map<string, THREE.Vector3> = new Map();
  targetVelocity: THREE.Vector3 = new THREE.Vector3();
  strafeDir: number = 1;
  
  constructor(botId: string) {
    super();
    this.botId = botId;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
  }
}

// ─── WANDER STATE ──────────────────────────────────────────────────────────
export class WanderState extends YUKA.State {
  enter(bot: BotEntity) {
    bot.steering.clear();
    const wander = new YUKA.WanderBehavior();
    wander.radius = 5;
    wander.distance = 5;
    wander.jitter = 2;
    // @ts-ignore
    wander.active = true;
    wander.weight = 1.0;
    bot.steering.add(wander);
    
    // Load telemetry data if not already loaded
    AITelemetryBrain.getInstance().loadTelemetry();
  }

  execute(bot: BotEntity, time: any, delta: number) {
    const store = useGameStore.getState();
    const me = store.enemies[bot.botId];
    if (!me || me.status === 'dead') return;

    // Check economy loop periodically
    if (Math.random() < 0.005) {
      store.botBuyUpgrade(bot.botId);
    }

    // Look for target
    let nearestDist = Infinity;
    let targetEntityId: string | null = null;
    
    // Check player
    if (store.playerTeamId !== me.teamId && store.status === 'alive') {
      const pPos = new THREE.Vector3(...store.playerPosition);
      const dist = bot.position.distanceTo(pPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        targetEntityId = 'player';
      }
    }

    // Check other bots
    Object.values(store.enemies).forEach(enemy => {
      // @ts-ignore
      if (enemy.id !== me.id && enemy.teamId !== me.teamId && enemy.status === 'alive') {
        const ePos = new THREE.Vector3(...enemy.position);
        const dist = bot.position.distanceTo(ePos);
        if (dist < nearestDist) {
          nearestDist = dist;
          targetEntityId = enemy.id;
        }
      }
    });

    if (targetEntityId && nearestDist < 40) {
      // Found target, transition to combat
      bot.stateMachine.changeTo('COMBAT');
    }

    // Apply Telemetry learning
    const brain = AITelemetryBrain.getInstance();
    const posThree = new THREE.Vector3(bot.position.x, bot.position.y, bot.position.z);
    const safetySteering = brain.getSafetySteering(posThree);
    const attractionSteering = brain.getAttractionSteering(posThree);
    
    // Combine steering forces softly
    const netSteering = safetySteering.clone().add(attractionSteering);
    
    if (netSteering.lengthSq() > 0) {
      // Nudge bot away from danger and towards paths manually via velocity
      bot.velocity.x += netSteering.x * delta;
      bot.velocity.z += netSteering.z * delta;
    }
    
    if (brain.shouldJumpNow(posThree)) {
      // Set an arbitrary flag so the physics component (Enemies.tsx) can apply jump force
      (bot as any).wantsToJump = true;
    }
  }

  exit(bot: BotEntity) {
    bot.steering.clear();
  }
}


// ─── COMBAT STATE ──────────────────────────────────────────────────────────
export class CombatState extends YUKA.State {
  seekBehavior = new YUKA.SeekBehavior();

  enter(bot: BotEntity) {
    bot.steering.clear();
    this.seekBehavior.weight = 1.0;
    // @ts-ignore
    this.seekBehavior.active = true;
    bot.steering.add(this.seekBehavior);
    
    AITelemetryBrain.getInstance().loadTelemetry();
  }

  execute(bot: BotEntity, time: any, delta: number) {
    const store = useGameStore.getState();
    const me = store.enemies[bot.botId];
    if (!me || me.status === 'dead') return;

    // Flee if HP is very low or evasiveness is very high due to damage bursts
    if (me.hp < 30 || me.evasiveness > 0.6) {
       bot.stateMachine.changeTo('FLEE');
       return;
    }

    let nearestDist = Infinity;
    let nearestPos: THREE.Vector3 | null = null;
    let targetEntityId: string | null = null;

    // Check player
    if (store.playerTeamId !== me.teamId && store.status === 'alive') {
      const pPos = new THREE.Vector3(...store.playerPosition);
      const dist = bot.position.distanceTo(pPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPos = pPos;
        targetEntityId = 'player';
      }
    }

    // Check other bots
    Object.values(store.enemies).forEach(enemy => {
      // @ts-ignore
      if (enemy.id !== me.id && enemy.teamId !== me.teamId && enemy.status === 'alive') {
        const ePos = new THREE.Vector3(...enemy.position);
        const dist = bot.position.distanceTo(ePos);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPos = ePos;
          targetEntityId = enemy.id;
        }
      }
    });

    if (!targetEntityId || !nearestPos || nearestDist > 50) {
      bot.stateMachine.changeTo('WANDER');
      return;
    }

    // Velocity Tracking for Target
    const prevPos = bot.targetPositionHistory.get(targetEntityId);
    if (prevPos) {
       bot.targetVelocity.copy(nearestPos).sub(prevPos).divideScalar(delta || 0.016);
    }
    bot.targetPositionHistory.set(targetEntityId, nearestPos.clone());

    // Predictive Seek (aiming ahead instead of directly at them)
    const predictionTime = Math.min(1.5, nearestDist / 30.0);
    const predictedPos = nearestPos.clone().add(bot.targetVelocity.clone().multiplyScalar(predictionTime));
    
    // If they get too close, Seek pushes too hard. Let's maintain a buffer range.
    if (nearestDist < 12) {
       this.seekBehavior.target.copy(bot.position); // Stop seeking closer naturally
    } else {
       this.seekBehavior.target.copy(predictedPos);
    }
    
    // Orthogonal Strafing (Dodge mechanics)
    if (Math.random() < 0.02) bot.strafeDir *= -1; // Change direction occasionally
    const toTarget = nearestPos.clone().sub(bot.position).normalize();
    const strafeVec = new THREE.Vector3(-toTarget.z, 0, toTarget.x).normalize().multiplyScalar(bot.strafeDir * 20 * delta);
    
    // Apply strafe dynamically
    bot.velocity.add(strafeVec);

    // Save target for aiming/hooking inside Enemies.tsx
    // @ts-ignore
    bot.combatTargetPos = nearestPos;
    // @ts-ignore
    bot.combatTargetDist = nearestDist;
    // @ts-ignore
    bot.combatTargetId = targetEntityId;

    // Apply Telemetry learning
    const brain = AITelemetryBrain.getInstance();
    const posThree = new THREE.Vector3(bot.position.x, bot.position.y, bot.position.z);
    const safetySteering = brain.getSafetySteering(posThree);
    const attractionSteering = brain.getAttractionSteering(posThree);
    
    // Combine steering forces softly
    const netSteering = safetySteering.clone().add(attractionSteering);
    
    if (netSteering.lengthSq() > 0) {
      bot.velocity.x += netSteering.x * delta;
      bot.velocity.z += netSteering.z * delta;
    }
    if (brain.shouldJumpNow(posThree)) {
      (bot as any).wantsToJump = true;
    }
  }

  exit(bot: BotEntity) {
    bot.steering.clear();
    // @ts-ignore
    bot.combatTargetPos = null;
  }
}

// ─── FLEE STATE ────────────────────────────────────────────────────────────
export class FleeState extends YUKA.State {
  fleeBehavior = new YUKA.FleeBehavior();
  fleeTimer = 0;

  enter(bot: BotEntity) {
    bot.steering.clear();
    this.fleeBehavior.weight = 1.0;
    // @ts-ignore
    this.fleeBehavior.active = true;
    bot.steering.add(this.fleeBehavior);
    this.fleeTimer = 3.0; // Run away for at least 3 seconds
  }

  execute(bot: BotEntity, time: any, delta: number) {
    const store = useGameStore.getState();
    const me = store.enemies[bot.botId];
    if (!me || me.status === 'dead') return;
    
    this.fleeTimer -= delta;

    let nearestDist = Infinity;
    let nearestPos: THREE.Vector3 | null = null;
    
    if (store.playerTeamId !== me.teamId && store.status === 'alive') {
      const pPos = new THREE.Vector3(...store.playerPosition);
      const dist = bot.position.distanceTo(pPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPos = pPos;
      }
    }

    if (nearestPos) {
       this.fleeBehavior.target.set(nearestPos.x, nearestPos.y, nearestPos.z);
    }
    
    // Periodically cool down evasiveness constraint
    if (me.evasiveness > 0.1) {
      store.setStats({
        enemies: {
          ...store.enemies,
          [me.id]: { ...me, evasiveness: Math.max(0.1, me.evasiveness - delta * 0.1) }
        }
      });
    }

    if (this.fleeTimer <= 0) {
      // If we recovered a bit or cooled down, go back to wandering
      bot.stateMachine.changeTo('WANDER');
    }
  }

  exit(bot: BotEntity) {
    bot.steering.clear();
  }
}
