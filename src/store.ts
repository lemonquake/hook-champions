import { create } from 'zustand';
import confetti from 'canvas-confetti';
import PartySocket from 'partysocket';

export interface EnemyData {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  position: [number, number, number];
  teamId: number;
  isAI: boolean;
  kills: number;
  deaths: number;
  shotsFired: number;
  shotsHit: number;
  status: 'alive' | 'dead';
  respawnTimer: number;
}

export interface PeerData {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  teamId: number;
  status: 'alive' | 'dead';
  hookStatus: 'idle' | 'firing' | 'retracting';
  hookPos: [number, number, number] | null;
}

export interface TeamConfig {
  id: number;
  color: string;
  playerCount: number;
  aiCount: number;
  basePosition: [number, number, number];
}

export type MapTheme = 'Cyber' | 'Jungle' | 'Snow' | 'City';

export type HookTipType = 'shuriken' | 'anchor' | 'scythe' | 'trident' | 'harpoon' | 'dagger' | 'claw' | 'drill' | 'star' | 'arrow' | 'crescent' | 'sawblade' | 'kunai' | 'golden_dragon' | 'plasma_caster' | 'void_shard';
export type ChainLinkType = 'torus' | 'box' | 'cylinder' | 'ring' | 'chainmail' | 'dna' | 'hex' | 'spike' | 'skull' | 'crystal' | 'gear' | 'orb' | 'diamond';

export type AugmentType = 'vampire_protocol' | 'bounty_hunter' | 'titanium_armor';

interface GameState {
  gameState: 'menu' | 'playing';
  hp: number;
  maxHp: number;
  playerPosition: [number, number, number];
  playerTeamId: number;
  playerName: string;
  cooldown: number;
  hookLength: number;
  hookSpeed: number;
  retractSpeed: number;
  moveSpeed: number;
  maxHookLength: number;
  
  hookTip: HookTipType;
  chainLink: ChainLinkType;
  points: number;
  augments: string[];
  
  kills: number;
  deaths: number;
  shotsFired: number;
  shotsHit: number;
  status: 'alive' | 'dead';
  respawnTimer: number;

  enemies: Record<string, EnemyData>;
  teams: TeamConfig[];
  mapConfig: { seed: number; density: number; size: number; theme: MapTheme };
  peers: Record<string, PeerData>;
  
  setStats: (stats: Partial<GameState>) => void;
  damageEnemy: (id: string, amount: number, attackerId: string) => void;
  damagePlayer: (amount: number, attackerId: string) => void;
  recordShot: (id: string, hit: boolean) => void;
  tickRespawn: (delta: number) => void;
  startGame: () => void;
  buyUpgrade: (type: string, cost: number, value: any) => void;
  respecUpgrades: () => void;
  
  initMultiplayer: () => void;
  broadcastState: (state: Partial<PeerData>) => void;
  
  // Hook penalty system (snagged units get their hook put on cooldown)
  hookPenalties: Record<string, number>; // entityId -> penalty timestamp
  applyHookPenalty: (entityId: string) => void;
  
  // Effects System
  effects: { id: string; type: 'impact' | 'dust'; position: [number, number, number]; color: string; time: number }[];
  spawnEffect: (type: 'impact' | 'dust', position: [number, number, number], color: string) => void;
  removeEffect: (id: string) => void;
}

let socket: PartySocket | null = null;

export const useGameStore = create<GameState>((set, get) => ({
  gameState: 'menu',
  hp: 100,
  maxHp: 100,
  playerPosition: [0, 1, 0],
  playerTeamId: 1,
  playerName: 'Player',
  cooldown: 0,
  hookLength: 0,
  hookSpeed: 22.5,
  retractSpeed: 17.14 * 1.3, // 22.282
  moveSpeed: 12,
  maxHookLength: 30,
  
  hookTip: 'shuriken',
  chainLink: 'torus',
  points: 50000,
  augments: [],
  
  kills: 0,
  deaths: 0,
  shotsFired: 0,
  shotsHit: 0,
  status: 'alive',
  respawnTimer: 0,

  enemies: {},
  teams: [
    { id: 1, color: '#22d3ee', playerCount: 1, aiCount: 0, basePosition: [-20, 0, -20] },
    { id: 2, color: '#ff3333', playerCount: 0, aiCount: 3, basePosition: [20, 0, 20] },
  ],
  mapConfig: { seed: Math.random(), density: 0.15, size: 60, theme: 'Cyber' },
  peers: {},
  hookPenalties: {},
  effects: [],
  
  applyHookPenalty: (entityId) => set((state) => ({
    hookPenalties: { ...state.hookPenalties, [entityId]: performance.now() / 1000 }
  })),
  
  spawnEffect: (type, position, color) => set((state) => ({
    effects: [...state.effects, { id: Math.random().toString(), type, position, color, time: performance.now() }]
  })),
  
  removeEffect: (id) => set((state) => ({
    effects: state.effects.filter(e => e.id !== id)
  })),
  
  setStats: (stats) => set((state) => ({ ...state, ...stats })),
  
  damageEnemy: (id, amount, attackerId) => set((state) => {
    const enemy = state.enemies[id];
    if (!enemy || enemy.status === 'dead') return state;
    
    const newHp = enemy.hp - amount;
    if (newHp <= 0) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#ff0000', '#ffaa00', '#ffff00', '#00ffff', '#ff00ff'],
        zIndex: 9999,
        startVelocity: 45
      });
      
      const updates: Partial<GameState> = {
        enemies: {
          ...state.enemies,
          [id]: { ...enemy, hp: 0, status: 'dead', respawnTimer: 3, deaths: enemy.deaths + 1 }
        }
      };
      
      if (attackerId === 'player') {
        updates.kills = state.kills + 1;
        let pointsGain = 100;
        if (state.augments.includes('bounty_hunter')) pointsGain *= 1.5;
        updates.points = state.points + pointsGain;
        if (state.augments.includes('vampire_protocol') && state.hp < state.maxHp) {
          updates.hp = Math.min(state.maxHp, state.hp + 25);
        }
      } else if (state.enemies[attackerId]) {
        updates.enemies = {
          ...updates.enemies,
          [attackerId]: {
            ...state.enemies[attackerId],
            kills: state.enemies[attackerId].kills + 1
          }
        };
      }
      return updates;
    }
    
    return {
      enemies: {
        ...state.enemies,
        [id]: { ...enemy, hp: newHp }
      }
    };
  }),

  damagePlayer: (amount, attackerId) => set((state) => {
    if (state.status === 'dead') return state;
    
    let finalDamage = amount;
    if (state.augments.includes('titanium_armor')) {
      finalDamage *= 0.8;
    }
    const newHp = state.hp - finalDamage;
    if (newHp <= 0) {
      const updates: Partial<GameState> = {
        hp: 0,
        status: 'dead',
        respawnTimer: 3,
        deaths: state.deaths + 1
      };
      
      if (attackerId !== 'player' && state.enemies[attackerId]) {
        updates.enemies = {
          ...state.enemies,
          [attackerId]: {
            ...state.enemies[attackerId],
            kills: state.enemies[attackerId].kills + 1
          }
        };
      }
      return updates;
    }
    return { hp: newHp };
  }),

  recordShot: (id, hit) => set((state) => {
    if (id === 'player') {
      return {
        shotsFired: state.shotsFired + 1,
        shotsHit: state.shotsHit + (hit ? 1 : 0)
      };
    } else if (state.enemies[id]) {
      return {
        enemies: {
          ...state.enemies,
          [id]: {
            ...state.enemies[id],
            shotsFired: state.enemies[id].shotsFired + 1,
            shotsHit: state.enemies[id].shotsHit + (hit ? 1 : 0)
          }
        }
      };
    }
    return state;
  }),

  tickRespawn: (delta) => set((state) => {
    let changed = false;
    const updates: Partial<GameState> = {};
    
    if (state.status === 'dead') {
      const newTimer = state.respawnTimer - delta;
      if (newTimer <= 0) {
        changed = true;
        updates.status = 'alive';
        updates.hp = state.maxHp;
        updates.respawnTimer = 0;
        const team = state.teams.find(t => t.id === state.playerTeamId);
        if (team) {
          updates.playerPosition = [team.basePosition[0], 5, team.basePosition[2]];
        }
      } else {
        changed = true;
        updates.respawnTimer = newTimer;
      }
    }
    
    const newEnemies = { ...state.enemies };
    let enemiesChanged = false;
    
    Object.keys(newEnemies).forEach(id => {
      const enemy = newEnemies[id];
      if (enemy.status === 'dead') {
        const newTimer = enemy.respawnTimer - delta;
        if (newTimer <= 0) {
          enemiesChanged = true;
          const team = state.teams.find(t => t.id === enemy.teamId);
          newEnemies[enemy.id] = {
            ...enemy,
            status: 'alive',
            hp: enemy.maxHp,
            respawnTimer: 0,
            position: team ? [team.basePosition[0] + (Math.random()-0.5)*5, 5, team.basePosition[2] + (Math.random()-0.5)*5] : enemy.position
          };
        } else {
          enemiesChanged = true;
          newEnemies[enemy.id] = { ...enemy, respawnTimer: newTimer };
        }
      }
    });
    
    if (enemiesChanged) updates.enemies = newEnemies;
    
    return changed || enemiesChanged ? updates : state;
  }),

  startGame: () => {
    const { teams, mapConfig } = get();
    const newEnemies: Record<string, EnemyData> = {};
    
    // Calculate base positions randomly
    const corners = [
      [-1, -1],
      [1, 1],
      [-1, 1],
      [1, -1]
    ];
    const updatedTeams = teams.map((team, index) => {
      const radius = mapConfig.size * 0.4;
      return {
        ...team,
        basePosition: [corners[index % 4][0] * radius, 0, corners[index % 4][1] * radius] as [number, number, number]
      };
    });

    let botIndex = 1;
    updatedTeams.forEach(team => {
      for (let i = 0; i < team.aiCount; i++) {
        const id = `bot-${botIndex++}`;
        newEnemies[id] = {
          id,
          name: `Bot ${botIndex - 1}`,
          hp: 100,
          maxHp: 100,
          position: [team.basePosition[0] + (Math.random()-0.5)*5, 5, team.basePosition[2] + (Math.random()-0.5)*5],
          teamId: team.id,
          isAI: true,
          kills: 0,
          deaths: 0,
          shotsFired: 0,
          shotsHit: 0,
          status: 'alive',
          respawnTimer: 0
        };
      }
    });

    const playerTeam = updatedTeams.find(t => t.id === get().playerTeamId);

    get().initMultiplayer();

    set({ 
      gameState: 'playing', 
      teams: updatedTeams,
      enemies: newEnemies, 
      hp: get().maxHp,
      status: 'alive',
      kills: 0,
      deaths: 0,
      shotsFired: 0,
      shotsHit: 0,
      points: 50000,
      playerPosition: playerTeam ? [playerTeam.basePosition[0], 5, playerTeam.basePosition[2]] : [0, 5, 0]
    });
  },

  buyUpgrade: (type, cost, value) => set((state) => {
    if (state.points >= cost) {
      if (type === 'augment') {
        if (!state.augments.includes(value)) {
          return {
            points: state.points - cost,
            augments: [...state.augments, value]
          };
        }
        return state;
      }
      return {
        points: state.points - cost,
        [type]: value
      };
    }
    return state;
  }),

  respecUpgrades: () => set((state) => {
    let refund = 0;
    refund += ((state.hookSpeed - 22.5) / 5) * 200;
    refund += ((state.retractSpeed - (17.14 * 1.3)) / 5) * 250;
    refund += ((state.maxHookLength - 30) / 10) * 150;
    refund += ((state.maxHp - 100) / 50) * 300;
    
    if (refund <= 0) return state;

    return {
      points: Math.floor(state.points + (refund * 0.9)), // 10% penalty
      hookSpeed: 22.5,
      retractSpeed: 17.14 * 1.3,
      maxHookLength: 30,
      hp: Math.min(state.hp, 100)
    };
  }),

  initMultiplayer: () => {
    if (socket) return;
    socket = new PartySocket({
      host: "localhost:1999",
      room: "hook-arena",
    });

    socket.addEventListener("message", (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'getState') {
        // Optionally respond with full state if we are host
      } else if (data.type === 'peerUpdate') {
        set((state) => ({
          peers: {
            ...state.peers,
            [data.id]: {
              ...(state.peers[data.id] || {}),
              ...data.peerData,
              id: data.id
            }
          }
        }));
      } else if (data.type === 'playerLeft') {
        set((state) => {
          const newPeers = { ...state.peers };
          delete newPeers[data.id];
          return { peers: newPeers };
        });
      }
    });
  },

  broadcastState: (peerData) => {
    if (!socket) return;
    socket.send(JSON.stringify({
      type: 'peerUpdate',
      id: socket.id,
      peerData
    }));
  }
}));
