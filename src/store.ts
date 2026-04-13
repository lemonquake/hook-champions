import { create } from 'zustand';
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
  points: number;
  hookTip: HookTipType;
  chainLink: ChainLinkType;
  predictionLead: number;
  evasiveness: number;
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

export type MapDesign = 'The Pit' | 'Crossfire' | 'Highrise' | 'Fortress' | 'Orbital' | 'Volcano';

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
  mapConfig: { seed: number; density: number; size: number; theme: MapDesign; startPoints: number };
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
  
  // Maim debuff system (pushing hook)
  maimDebuffs: Record<string, number>; // entityId -> expiry timestamp
  applyMaim: (entityId: string) => void;
  isMaimed: (entityId: string) => boolean;
  pushHookCooldown: number; // remaining seconds for UI
  
  // Push kill credit system
  lastPushedBy: Record<string, { attackerId: string; time: number }>;
  applyPushCredit: (targetId: string, attackerId: string) => void;
  
  // Kill feed effects (arena-wide kill announcements)
  killFeedEffects: { id: string; variant: number; victimName: string; killerName: string; method: 'hook' | 'push' | 'hazard' | 'blade'; message: string; time: number }[];
  spawnArenaKillAnnouncement: (killerName: string, victimName: string, method: 'hook' | 'push' | 'hazard' | 'blade') => void;
  removeKillEffect: (id: string) => void;
  
  // Effects System
  effects: { id: string; type: 'impact' | 'dust' | 'blood_explosion'; position: [number, number, number]; color: string; time: number }[];
  spawnEffect: (type: 'impact' | 'dust' | 'blood_explosion', position: [number, number, number], color: string) => void;
  removeEffect: (id: string) => void;

  // Damage Feedbacks
  damageFeedbacks: { id: string; amount: number; position: [number, number, number]; isCrit: boolean; time: number; color?: string }[];
  spawnDamageFeedback: (amount: number, position: [number, number, number], isCrit?: boolean, color?: string) => void;
  removeDamageFeedback: (id: string) => void;

  // AI Economy
  botBuyUpgrade: (botId: string) => void;
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
  mapConfig: { seed: Math.random(), density: 0.15, size: 60, theme: 'The Pit', startPoints: 50000 },
  peers: {},
  hookPenalties: {},
  maimDebuffs: {},
  pushHookCooldown: 0,
  lastPushedBy: {},
  killFeedEffects: [],
  effects: [],
  damageFeedbacks: [],
  
  applyHookPenalty: (entityId) => set((state) => ({
    hookPenalties: { ...state.hookPenalties, [entityId]: performance.now() / 1000 }
  })),
  
  applyMaim: (entityId) => set((state) => ({
    maimDebuffs: { ...state.maimDebuffs, [entityId]: performance.now() / 1000 + 0.5 }
  })),
  
  isMaimed: (entityId) => {
    const expiry = get().maimDebuffs[entityId];
    if (!expiry) return false;
    return performance.now() / 1000 < expiry;
  },
  
  applyPushCredit: (targetId, attackerId) => set((state) => {
    const existing = state.lastPushedBy[targetId];
    const now = performance.now() / 1000;
    if (existing && (now - existing.time) < 15) {
      return state; // Register the first caster by skipping override
    }
    return {
      lastPushedBy: { ...state.lastPushedBy, [targetId]: { attackerId, time: now } }
    };
  }),
  
  spawnArenaKillAnnouncement: (killerName, victimName, method) => set((state) => {
    // 40 hilarious context-aware kill messages
    const hookMessages = [
      `🪝 ${killerName} RIPPED ${victimName}'s SPINE OUT!! GET REKT!!`,
      `${killerName} SNATCHED ${victimName} LIKE A DAMN PIÑATA! 🎉`,
      `${killerName} just hooked ${victimName} in the TAINT! DEVASTATING!!`,
      `YOINK!! ${killerName} RAGDOLLED ${victimName} into oblivion!`,
      `Holy SHIT! ${killerName} SNAGGED ${victimName}'s SOUL!! 💀`,
      `${killerName} sent ${victimName} to THERAPY with that hook!!`,
      `GET OVER HERE!! ${killerName} SCORPION'D ${victimName}!!`,
      `🎣 ${killerName} caught a CLOWN FISH named ${victimName}!!`,
      `${killerName} dragged ${victimName} through HELL... forgot the 'back' part!!`,
      `REST IN PIECES, ${victimName}! Signed, ${killerName} 💀`,
    ];
    const pushMessages = [
      `DAMN! ${victimName} was OBLITERATED no thanks to that PSYCHO ${killerName}!!`,
      `🫸 ${killerName} kicked ${victimName} in the BALLS off the edge!! YEET!!`,
      `${killerName} said 'BYE BITCH!' and LAUNCHED ${victimName} into the shadow realm!!`,
      `FATALITY!! ${killerName} YEETED ${victimName} off the map like DIRTY LAUNDRY!!`,
      `${victimName} got SPARTA KICKED by ${killerName}!! THIS. IS. ARENA!!`,
      `LOL ${killerName} just DELETED ${victimName} from existence!! UNINSTALLED!!`,
      `✈️ ${victimName}'s FLIGHT to HELL sponsored by ${killerName}!!`,
      `${killerName} gave ${victimName} a ONE-WAY TICKET to the MEAT GRINDER!!`,
      `ADIOS, ${victimName}!! ${killerName} said GET THE FUCK OUT!! 🫡`,
      `PUSHED!! ${victimName} tried to fly BUT FORGOT HOW! Thanks ${killerName}!!`,
    ];
    const hazardMessages = [
      `🩸 ${victimName} got SHREDDED INTO CONFETTI by the blades!! BRUTAL!!`,
      `RIP ${victimName}!! The blades turned 'em into a SMOOTHIE!! 🥤`,
      `LMAOOO ${victimName} just WALKED into the blades like a TOTAL DUMBASS!!`,
      `${victimName}'s last words: 'I wonder what this button do—' *BRRRRRT*!!`,
      `The BLADES claim another IDIOT!! ${victimName} is now PÂTÉ!! 🍖`,
    ];
    const genericMessages = [
      `💀 ${victimName} just got absolutely DEMOLISHED!! GARBAGE TIER!!`,
      `SKILL DIFF!! ${killerName} ANNIHILATED ${victimName} with ZERO MERCY!!`,
      `SEND MEDICS!! Oh wait... ${victimName} is ALREADY PASTE!! 🤮`,
      `AND THE CROWD GOES WILD!! ${killerName} BODIED ${victimName}!!`,
      `GG EZ!! ${victimName} got CLAPPED INTO NEXT CENTURY by ${killerName}!!`,
    ];
    // Gen Z slang fire 🔥
    const genZMessages = [
      `WOHOOOO! ${killerName} just ATE ${victimName} UP!! NO CRUMBS!! 🔥`,
      `HELL YEAHHH!! ${killerName} is giving MAIN CHARACTER ENERGY rn!!`,
      `SKRRRRRT!! ${victimName} just got RATIO'D by ${killerName}!! 💀💀`,
      `This is some TYPESHIT right here!! ${killerName} is UNHINGED!!`,
      `OUTPLAYED!!!! ${victimName} is actually COOKED beyond recovery!!`,
      `Lowkey ${killerName} is DOMINATING ${victimName} like some TYPESHIT!! NO CAP!!`,
      `${victimName} is NOT him. ${killerName} is THE GOAT fr fr 🐐`,
      `SHEEEESH!! ${killerName} just had ${victimName} CATCHING Ls ALL DAY!! 📉`,
      `NAH BRO ${victimName} IS COOKED!! ${killerName} said 'sit down' RESPECTFULLY 💅`,
      `${killerName} went SICKO MODE on ${victimName}!! IT'S GIVING UNALIVE!! ☠️`,
    ];
    
    let pool: string[];
    switch (method) {
      case 'hook': pool = [...hookMessages, ...genericMessages, ...genZMessages]; break;
      case 'push': pool = [...pushMessages, ...genericMessages, ...genZMessages]; break;
      case 'hazard':
      case 'blade': pool = [...hazardMessages, ...genericMessages, ...genZMessages]; break;
      default: pool = [...genericMessages, ...genZMessages];
    }
    const message = pool[Math.floor(Math.random() * pool.length)];
    
    return {
      killFeedEffects: [...state.killFeedEffects, {
        id: Math.random().toString(),
        variant: Math.floor(Math.random() * 30),
        victimName,
        killerName,
        method,
        message,
        time: performance.now()
      }]
    };
  }),
  
  removeKillEffect: (id) => set((state) => ({
    killFeedEffects: state.killFeedEffects.filter(e => e.id !== id)
  })),
  
  spawnEffect: (type, position, color) => set((state) => ({
    effects: [...state.effects, { id: Math.random().toString(), type, position, color, time: performance.now() }]
  })),
  
  removeEffect: (id) => set((state) => ({
    effects: state.effects.filter(e => e.id !== id)
  })),

  spawnDamageFeedback: (amount, position, isCrit = false, color = '#ffffff') => set((state) => ({
    damageFeedbacks: [...state.damageFeedbacks, { id: Math.random().toString(), amount, position, isCrit, time: performance.now(), color }]
  })),

  removeDamageFeedback: (id) => set((state) => ({
    damageFeedbacks: state.damageFeedbacks.filter(d => d.id !== id)
  })),
  
  setStats: (stats) => set((state) => ({ ...state, ...stats })),
  
  damageEnemy: (id, amount, attackerId) => set((state) => {
    const enemy = state.enemies[id];
    if (!enemy || enemy.status === 'dead') return state;
    
    // Check push credit — if killed by hazard, credit the pusher
    let effectiveAttacker = attackerId;
    if (attackerId === 'hazard') {
      const pushCredit = state.lastPushedBy[id];
      if (pushCredit && (performance.now() / 1000 - pushCredit.time) < 15) {
        effectiveAttacker = pushCredit.attackerId;
      }
    }
    
    const newHp = enemy.hp - amount;
    if (newHp <= 0) {
      const updates: Partial<GameState> = {
        enemies: {
          ...state.enemies,
          [id]: { ...enemy, hp: 0, status: 'dead', respawnTimer: 3, deaths: enemy.deaths + 1 }
        }
      };
      
      if (effectiveAttacker === 'player') {
        updates.kills = state.kills + 1;
        let pointsGain = 100;
        if (state.augments.includes('bounty_hunter')) pointsGain *= 1.5;
        updates.points = state.points + pointsGain;
        if (state.augments.includes('vampire_protocol') && state.hp < state.maxHp) {
          updates.hp = Math.min(state.maxHp, state.hp + 25);
        }
        // Spawn arena-wide kill announcement
        const killMethod = attackerId === 'hazard' ? 'blade' as const : 'hook' as const;
        setTimeout(() => get().spawnArenaKillAnnouncement(state.playerName, enemy.name, killMethod), 0);
      } else if (state.enemies[effectiveAttacker]) {
        const killerBot = state.enemies[effectiveAttacker];
        updates.enemies = {
          ...updates.enemies,
          [effectiveAttacker]: {
            ...killerBot,
            kills: killerBot.kills + 1
          }
        };
        // Bot-vs-bot or bot-vs-enemy kill announcement
        const killMethod = attackerId === 'hazard' ? 'blade' as const : 'hook' as const;
        setTimeout(() => get().spawnArenaKillAnnouncement(killerBot.name, enemy.name, killMethod), 0);
      } else if (attackerId === 'hazard') {
        // Pure hazard death (no push credit) — environmental kill
        setTimeout(() => get().spawnArenaKillAnnouncement('The Arena', enemy.name, 'blade'), 0);
      }
      
      // Clean up push credit
      const newPushCredits = { ...state.lastPushedBy };
      delete newPushCredits[id];
      updates.lastPushedBy = newPushCredits;
      
      return updates;
    }
    
    // Spawn damage number
    get().spawnDamageFeedback(amount, enemy.position, false, state.teams.find(t=>t.id===enemy.teamId)?.color);
    
    return {
      enemies: {
        ...state.enemies,
        [id]: { ...enemy, hp: newHp, evasiveness: Math.min(1.0, enemy.evasiveness + 0.1) } // Increase evasiveness when taking damage
      }
    };
  }),

  damagePlayer: (amount, attackerId) => set((state) => {
    if (state.status === 'dead') return state;
    
    // Check push credit — if killed by hazard, credit the pusher
    let effectiveAttacker = attackerId;
    if (attackerId === 'hazard') {
      const pushCredit = state.lastPushedBy['player'];
      if (pushCredit && (performance.now() / 1000 - pushCredit.time) < 15) {
        effectiveAttacker = pushCredit.attackerId;
      }
    }
    
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
      
      if (effectiveAttacker !== 'player' && effectiveAttacker !== 'hazard' && state.enemies[effectiveAttacker]) {
        const killerBot = state.enemies[effectiveAttacker];
        updates.enemies = {
          ...state.enemies,
          [effectiveAttacker]: {
            ...killerBot,
            kills: killerBot.kills + 1
          }
        };
        // Bot killed player — arena announcement
        const killMethod = attackerId === 'hazard' ? 'blade' as const : 'hook' as const;
        setTimeout(() => get().spawnArenaKillAnnouncement(killerBot.name, state.playerName, killMethod), 0);
      } else if (effectiveAttacker === 'hazard' || attackerId === 'hazard') {
        // Pure hazard death
        setTimeout(() => get().spawnArenaKillAnnouncement('The Arena', state.playerName, 'blade'), 0);
      }
      
      // Clean up push credit
      const newPushCredits = { ...state.lastPushedBy };
      delete newPushCredits['player'];
      updates.lastPushedBy = newPushCredits;
      
      return updates;
    }
    get().spawnDamageFeedback(finalDamage, state.playerPosition, false, '#22d3ee');
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
          respawnTimer: 0,
          points: get().mapConfig.startPoints,
          hookTip: 'shuriken',
          chainLink: 'torus',
          predictionLead: 1.0,
          evasiveness: 0.1
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
      points: get().mapConfig.startPoints,
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

  botBuyUpgrade: (botId) => set((state) => {
    const enemy = state.enemies[botId];
    if (!enemy || enemy.status === 'dead') return state;

    // VERY primitive bot economy logic (buy random stuff if rich)
    if (enemy.points > 1000) {
      if (Math.random() > 0.5) {
        // Buy random hook tip
        const tips: HookTipType[] = ['anchor', 'scythe', 'trident', 'harpoon'];
        const tip = tips[Math.floor(Math.random() * tips.length)];
        return {
          enemies: {
            ...state.enemies,
            [botId]: { ...enemy, hookTip: tip, points: enemy.points - 500 }
          }
        };
      } else {
        // Buy random chain link
        const links: ChainLinkType[] = ['box', 'cylinder', 'ring', 'chainmail', 'dna', 'skull'];
        const link = links[Math.floor(Math.random() * links.length)];
        return {
          enemies: {
            ...state.enemies,
            [botId]: { ...enemy, chainLink: link, points: enemy.points - 1000 }
          }
        };
      }
    }
    return state;
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
