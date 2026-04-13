import * as YUKA from 'yuka';
import * as THREE from 'three';
import { useGameStore } from '../store';

// We create a custom Vehicle to hold bot-specific data needed by states
export class BotEntity extends (YUKA as any).Vehicle {
  botId: string;
  
  constructor(botId: string) {
    super();
    this.botId = botId;
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
  }

  execute(bot: BotEntity) {
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
  }

  execute(bot: BotEntity) {
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

    // Adapt learning: if target is moving fast, apply prediction lead
    // But since Yuka Seek directly sets target, we can just feed it nearestPos
    this.seekBehavior.target.set(nearestPos.x, nearestPos.y, nearestPos.z);
    
    // Save target for aiming/hooking inside Enemies.tsx
    // @ts-ignore
    bot.combatTargetPos = nearestPos;
    // @ts-ignore
    bot.combatTargetDist = nearestDist;
    // @ts-ignore
    bot.combatTargetId = targetEntityId;
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
