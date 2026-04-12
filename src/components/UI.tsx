import React, { useState, useEffect } from 'react';
import { useGameStore, EnemyData } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, Skull, Target, Shield, Zap, Anchor, Scissors, Box, Circle, Cylinder } from 'lucide-react';

export const UI: React.FC = () => {
  const { hp, maxHp, cooldown, pushHookCooldown, hookLength, hookSpeed, retractSpeed, moveSpeed, status, respawnTimer, points } = useGameStore();
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showUpgrades, setShowUpgrades] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowScoreboard(true);
      }
      if (e.key === 'u' || e.key === 'U') {
        setShowUpgrades(prev => !prev);
        if (!showUpgrades) {
          document.exitPointerLock();
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowScoreboard(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showUpgrades]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex h-full w-full flex-col justify-between overflow-hidden font-mono text-white">
      {/* Crosshair */}
      {status === 'alive' && (
        <motion.div 
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={{ rotate: [0, 90] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          <div className="relative flex h-10 w-10 items-center justify-center">
            <div className="absolute h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)]" />
            <div className="absolute h-[60%] w-[2px] bg-cyan-500/50 mask-image-linear-gradient" />
            <div className="absolute h-[2px] w-[60%] bg-cyan-500/50" />
            <motion.div className="absolute h-12 w-12 rounded-full border border-dashed border-cyan-400/30" 
              animate={{ rotate: -180 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}

      {/* Top Bar */}
      <div className="flex w-full justify-between p-6">
        <div className="flex flex-col gap-2">
          <div className="sci-fi-panel px-6 py-2 border-l-4 border-red-500 flex items-center justify-center">
            <div className="text-4xl font-black tracking-tighter text-red-500 neon-text-red">
              {status === 'alive' ? `${Math.ceil(hp)} / ${maxHp}` : 'DEAD'}
            </div>
          </div>
          {/* Circular Cooldown Indicators */}
          {status === 'alive' && (
            <div className="flex items-center gap-3 mt-2 pl-2">
              <CooldownCircle 
                label="HOOK" 
                keybind="LMB" 
                cooldown={cooldown} 
                maxCooldown={2} 
                color="#22d3ee" 
                glowColor="rgba(34,211,238,0.6)" 
              />
              <CooldownCircle 
                label="PUSH" 
                keybind="RMB" 
                cooldown={pushHookCooldown} 
                maxCooldown={2} 
                color="#d946ef" 
                glowColor="rgba(217,70,239,0.6)" 
              />
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 sci-fi-panel px-4 py-1.5 border-r-2 border-green-500">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-green-400">Uplink Active</span>
          </div>
          <div className="sci-fi-panel px-6 py-2 border-r-4 border-yellow-400 mt-2">
            <div className="text-3xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,1)]">
              ${points.toLocaleString()}
            </div>
          </div>
          <div className="text-xs font-bold tracking-widest text-gray-400 mt-2 bg-black/40 px-3 py-1 sci-fi-button cursor-default hover:text-white transition-colors">SYSTEM LOG [TAB]</div>
          <div className="text-xs font-bold tracking-widest text-gray-400 bg-black/40 px-3 py-1 sci-fi-button cursor-default hover:text-white transition-colors">BLACK MARKET [U]</div>
        </div>
      </div>

      {/* Death Overlay */}
      <AnimatePresence>
        {status === 'dead' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md"
          >
            <div className="animate-scanline" />
            <h1 className="text-8xl font-black text-red-500 mb-4 glitch-hover neon-text-red">CRITICAL FAILURE</h1>
            <p className="text-3xl font-bold tracking-widest text-white/80 uppercase">Reboot sequence in {Math.ceil(respawnTimer)}s...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scoreboard */}
      <AnimatePresence>
        {showScoreboard && <Scoreboard />}
      </AnimatePresence>

      {/* Upgrades */}
      <AnimatePresence>
        {showUpgrades && <Upgrades onClose={() => setShowUpgrades(false)} />}
      </AnimatePresence>

      {/* Kill Celebration Effects */}
      <KillEffectsOverlay />

      {/* Bottom Stats */}
      <div className="flex w-full justify-between bg-gradient-to-t from-[#0a0f18]/80 to-transparent p-6 pt-20">
        <div className="flex gap-4">
          <StatBox label="Hook Length" value={`${hookLength}m`} />
          <StatBox label="Hook Speed" value={`${hookSpeed.toFixed(1)}m/s`} />
          <StatBox label="Retract Speed" value={`${retractSpeed.toFixed(1)}m/s`} />
          <StatBox label="Move Speed" value={`${moveSpeed}m/s`} />
        </div>
      </div>
    </div>
  );
};

// ─── Circular Cooldown Indicator Component ──────────────────────────
const CooldownCircle = ({ label, keybind, cooldown, maxCooldown, color, glowColor }: {
  label: string;
  keybind: string;
  cooldown: number;
  maxCooldown: number;
  color: string;
  glowColor: string;
}) => {
  const isReady = cooldown <= 0;
  const progress = isReady ? 1 : 1 - (cooldown / maxCooldown);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 64, height: 64 }}>
        {/* Background ring */}
        <svg width="64" height="64" className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="32" cy="32" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="4"
          />
          {/* Progress ring */}
          <circle
            cx="32" cy="32" r={radius}
            fill="none"
            stroke={isReady ? '#22c55e' : color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ 
              transition: 'stroke-dashoffset 0.1s linear',
              filter: isReady ? `drop-shadow(0 0 6px rgba(34,197,94,0.8))` : `drop-shadow(0 0 4px ${glowColor})`
            }}
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isReady ? (
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
              className="text-[11px] font-black tracking-wider"
              style={{ color: '#22c55e', textShadow: '0 0 8px rgba(34,197,94,0.8)' }}
            >
              READY
            </motion.div>
          ) : (
            <div 
              className="text-xl font-black tabular-nums"
              style={{ color, textShadow: `0 0 6px ${glowColor}` }}
            >
              {cooldown.toFixed(1)}
            </div>
          )}
        </div>
        
        {/* Ready pulse ring */}
        {isReady && (
          <motion.div
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: '#22c55e' }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
      
      {/* Label */}
      <div className="flex flex-col items-center">
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: isReady ? '#22c55e' : color }}>{label}</span>
        <span className="text-[8px] font-bold text-gray-500">{keybind}</span>
      </div>
    </div>
  );
};

const StatBox = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col sci-fi-panel px-4 py-2 border-l-4 border-cyan-400">
    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">{label}</span>
    <span className="text-2xl font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{value}</span>
  </div>
);

// ─── Kill Celebration Effects ──────────────────────────────────────
const KILL_TITLES = [
  { text: 'ELIMINATED', color: '#ef4444', glow: 'rgba(239,68,68,0.8)' },
  { text: 'DESTROYED', color: '#f97316', glow: 'rgba(249,115,22,0.8)' },
  { text: 'OBLITERATED', color: '#eab308', glow: 'rgba(234,179,8,0.8)' },
  { text: 'ANNIHILATED', color: '#a855f7', glow: 'rgba(168,85,247,0.8)' },
  { text: 'TERMINATED', color: '#22d3ee', glow: 'rgba(34,211,238,0.8)' },
  { text: 'WRECKED', color: '#f43f5e', glow: 'rgba(244,63,94,0.8)' },
  { text: 'VAPORIZED', color: '#06b6d4', glow: 'rgba(6,182,212,0.8)' },
  { text: 'CRUSHED', color: '#84cc16', glow: 'rgba(132,204,22,0.8)' },
  { text: 'DELETED', color: '#ec4899', glow: 'rgba(236,72,153,0.8)' },
  { text: 'SHATTERED', color: '#8b5cf6', glow: 'rgba(139,92,246,0.8)' },
];

const KillEffectsOverlay: React.FC = () => {
  const killFeedEffects = useGameStore(state => state.killFeedEffects);
  
  useEffect(() => {
    // Auto-cleanup old effects
    const interval = setInterval(() => {
      const now = performance.now();
      killFeedEffects.forEach(e => {
        if (now - e.time > 2500) {
          useGameStore.getState().removeKillEffect(e.id);
        }
      });
    }, 500);
    return () => clearInterval(interval);
  }, [killFeedEffects]);
  
  return (
    <AnimatePresence>
      {killFeedEffects.map(effect => (
        <KillEffect key={effect.id} effect={effect} />
      ))}
    </AnimatePresence>
  );
};

const KillEffect: React.FC<{ effect: { id: string; variant: number; victimName: string; time: number } }> = ({ effect }) => {
  const title = KILL_TITLES[effect.variant % KILL_TITLES.length];
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 pointer-events-none"
    >
      {/* Screen edge flash */}
      <motion.div
        className="absolute inset-0"
        style={{
          boxShadow: `inset 0 0 120px 30px ${title.glow}`,
        }}
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      
      {/* Kill title banner */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: '30%' }}
        initial={{ scale: 3, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.5, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15, duration: 0.5 }}
      >
        <div className="flex flex-col items-center gap-1">
          {/* Main kill verb */}
          <motion.div
            className="text-5xl font-black tracking-[0.3em] uppercase"
            style={{ 
              color: title.color, 
              textShadow: `0 0 30px ${title.glow}, 0 0 60px ${title.glow}, 0 2px 0 rgba(0,0,0,0.5)`,
              WebkitTextStroke: '1px rgba(255,255,255,0.2)'
            }}
            animate={{ 
              scale: [1, 1.05, 1],
              textShadow: [
                `0 0 30px ${title.glow}, 0 0 60px ${title.glow}`,
                `0 0 50px ${title.glow}, 0 0 100px ${title.glow}`,
                `0 0 30px ${title.glow}, 0 0 60px ${title.glow}`,
              ]
            }}
            transition={{ duration: 0.6, repeat: 2, ease: 'easeInOut' }}
          >
            {title.text}
          </motion.div>
          
          {/* Victim name */}
          <motion.div
            className="text-lg font-bold tracking-[0.5em] uppercase text-white/80"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            ◆ {effect.victimName} ◆
          </motion.div>
        </div>
      </motion.div>

      {/* Decorative lines shooting across */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-[2px]"
          style={{
            top: `${28 + i * 3}%`,
            backgroundColor: title.color,
            boxShadow: `0 0 10px ${title.glow}`,
          }}
          initial={{ left: '-100%', width: '60%', opacity: 0.8 }}
          animate={{ left: '140%', opacity: 0 }}
          transition={{ 
            duration: 0.6, 
            delay: 0.1 * i, 
            ease: 'easeOut' 
          }}
        />
      ))}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={`r-${i}`}
          className="absolute h-[2px]"
          style={{
            top: `${35 + i * 3}%`,
            backgroundColor: title.color,
            boxShadow: `0 0 10px ${title.glow}`,
          }}
          initial={{ right: '-100%', width: '50%', opacity: 0.8 }}
          animate={{ right: '140%', opacity: 0 }}
          transition={{ 
            duration: 0.5, 
            delay: 0.15 * i, 
            ease: 'easeOut' 
          }}
        />
      ))}

      {/* Corner skulls / decorations based on variant */}
      {effect.variant % 3 === 0 && (
        <>
          <motion.div
            className="absolute top-[25%] left-[15%] text-6xl"
            style={{ color: title.color, filter: `drop-shadow(0 0 10px ${title.glow})` }}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          >
            💀
          </motion.div>
          <motion.div
            className="absolute top-[25%] right-[15%] text-6xl"
            style={{ color: title.color, filter: `drop-shadow(0 0 10px ${title.glow})` }}
            initial={{ scale: 0, rotate: 180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
          >
            💀
          </motion.div>
        </>
      )}

      {/* Expanding ring effect */}
      {effect.variant % 3 === 1 && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 rounded-full border-2"
          style={{ top: '30%', borderColor: title.color, width: 40, height: 40 }}
          initial={{ scale: 0.5, opacity: 1 }}
          animate={{ scale: 8, opacity: 0 }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
        />
      )}
      
      {/* Particle burst (diamond shapes) */}
      {effect.variant % 3 === 2 && (
        <>
          {[...Array(8)].map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const dist = 200;
            return (
              <motion.div
                key={`p-${i}`}
                className="absolute w-3 h-3"
                style={{
                  left: '50%',
                  top: '32%',
                  backgroundColor: title.color,
                  boxShadow: `0 0 8px ${title.glow}`,
                  transform: 'rotate(45deg)',
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1.5 }}
                animate={{ 
                  x: Math.cos(angle) * dist, 
                  y: Math.sin(angle) * dist, 
                  opacity: 0, 
                  scale: 0 
                }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.05 * i }}
              />
            );
          })}
        </>
      )}

      {/* Points gained flash */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 text-2xl font-black"
        style={{ top: '42%', color: '#fbbf24', textShadow: '0 0 15px rgba(251,191,36,0.8)' }}
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: [0, 1, 1, 0], y: -40 }}
        transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
      >
        +$100
      </motion.div>

      {/* Glitch scan line effect */}
      <motion.div
        className="absolute left-0 right-0 h-1"
        style={{ 
          top: '30%',
          background: `linear-gradient(90deg, transparent, ${title.color}, transparent)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: [0, 1, 0, 0.8, 0],
          top: ['28%', '35%', '30%', '40%', '28%']
        }}
        transition={{ duration: 0.5, ease: 'linear' }}
      />
    </motion.div>
  );
};

const Scoreboard = () => {
  const { playerName, playerTeamId, kills, deaths, shotsFired, shotsHit, status, respawnTimer, enemies, teams } = useGameStore();

  const allPlayers = [
    {
      id: 'player',
      name: playerName,
      teamId: playerTeamId,
      kills,
      deaths,
      accuracy: shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0,
      status,
      respawnTimer
    },
    ...(Object.values(enemies) as EnemyData[]).map(e => ({
      id: e.id,
      name: e.name,
      teamId: e.teamId,
      kills: e.kills,
      deaths: e.deaths,
      accuracy: e.shotsFired > 0 ? Math.round((e.shotsHit / e.shotsFired) * 100) : 0,
      status: e.status,
      respawnTimer: e.respawnTimer
    }))
  ].sort((a, b) => b.kills - a.kills);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.95 }}
      className="absolute left-1/2 top-24 w-[850px] -translate-x-1/2 border-t-4 border-cyan-500 bg-[#0a0f18]/90 p-6 backdrop-blur-md sci-fi-panel hologram-card shadow-[0_0_50px_rgba(34,211,238,0.15)]"
    >
      <h2 className="mb-6 text-center text-3xl font-black tracking-widest text-cyan-400 neon-text-cyan">COMBAT SCOREBOARD</h2>
      
      <div className="grid grid-cols-6 gap-4 border-b border-white/20 pb-2 text-sm font-bold text-gray-400">
        <div className="col-span-2">NAME</div>
        <div className="text-center">KILLS</div>
        <div className="text-center">DEATHS</div>
        <div className="text-center">ACCURACY</div>
        <div className="text-right">STATUS</div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {allPlayers.map(p => {
          const team = teams.find(t => t.id === p.teamId);
          return (
            <div 
              key={p.id} 
              className={`grid grid-cols-6 gap-4 px-4 py-2 items-center mb-2 sci-fi-button transition-all hover:scale-[1.02] ${p.id === 'player' ? 'bg-cyan-500/20 border-cyan-400 shadow-[inset_0_0_15px_rgba(34,211,238,0.2)]' : 'bg-black/40 border-transparent hover:bg-white/10'}`}
              style={{ borderLeft: `4px solid ${team?.color || '#fff'}` }}
            >
              <div className="col-span-2 font-bold text-white flex items-center gap-2">
                {p.name} {p.id === 'player' && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">YOU</span>}
              </div>
              <div className="text-center text-lg text-white">{p.kills}</div>
              <div className="text-center text-lg text-gray-400">{p.deaths}</div>
              <div className="text-center text-white">{p.accuracy}%</div>
              <div className="text-right font-bold">
                {p.status === 'alive' ? (
                  <span className="text-green-400">ALIVE</span>
                ) : (
                  <span className="text-red-500">{Math.ceil(p.respawnTimer)}s</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

const Upgrades = ({ onClose }: { onClose: () => void }) => {
  const store = useGameStore();
  const [activeTab, setActiveTab] = React.useState<'stats' | 'augments' | 'cosmetics'>('stats');
  
  const upgrades = [
    { id: 'hookSpeed', name: 'Hook Speed', icon: <Zap size={20} />, cost: 200, current: store.hookSpeed, min: 22.5, step: 5, max: 50 },
    { id: 'retractSpeed', name: 'Retract Speed', icon: <Anchor size={20} />, cost: 250, current: store.retractSpeed, min: 17.14 * 1.3, step: 5, max: 50 },
    { id: 'maxHookLength', name: 'Hook Length', icon: <Target size={20} />, cost: 150, current: store.maxHookLength, min: 30, step: 10, max: 100 },
    { id: 'maxHp', name: 'Max HP', icon: <Shield size={20} />, cost: 300, current: store.maxHp, min: 100, step: 50, max: 500 },
  ];

  const augmentsData = [
    { id: 'vampire_protocol', name: 'Vampire Protocol', desc: 'Heal +25 HP on enemy kill.', cost: 800, icon: <Skull size={24} /> },
    { id: 'bounty_hunter', name: 'Bounty Hunter', desc: 'Earn +50% more money per kill.', cost: 600, icon: <Crosshair size={24} /> },
    { id: 'titanium_armor', name: 'Titanium Armor', desc: 'Take 20% less damage from all sources.', cost: 1200, icon: <Shield size={24} /> },
  ];

  const cosmetics = [
    { 
      category: 'hookTip', 
      name: 'Hook Tip', 
      items: [
        { id: 'shuriken', name: 'Shuriken', cost: 0 },
        { id: 'anchor', name: 'Anchor', cost: 500 },
        { id: 'scythe', name: 'Scythe', cost: 1000 },
        { id: 'trident', name: 'Trident', cost: 1500 },
        { id: 'harpoon', name: 'Harpoon', cost: 2000 },
        { id: 'dagger', name: 'Dagger', cost: 2500 },
        { id: 'claw', name: 'Claw', cost: 3000 },
        { id: 'drill', name: 'Drill', cost: 3500 },
        { id: 'star', name: 'Star', cost: 4000 },
        { id: 'arrow', name: 'Arrow', cost: 4500 },
        { id: 'crescent', name: 'Crescent', cost: 5000 },
        { id: 'sawblade', name: 'Sawblade', cost: 5500 },
        { id: 'kunai', name: 'Kunai', cost: 6000 },
        { id: 'golden_dragon', name: 'Golden Dragon (Special)', cost: 10000 },
        { id: 'plasma_caster', name: 'Plasma Caster (Special)', cost: 15000 },
        { id: 'void_shard', name: 'Void Shard (Special)', cost: 20000 }
      ]
    },
    { 
      category: 'chainLink', 
      name: 'Chain Link', 
      items: [
        { id: 'torus', name: 'Torus', cost: 0 },
        { id: 'box', name: 'Block', cost: 300 },
        { id: 'cylinder', name: 'Cylinder', cost: 600 },
        { id: 'ring', name: 'Ring', cost: 1000 },
        { id: 'chainmail', name: 'Chainmail', cost: 1500 },
        { id: 'dna', name: 'DNA Helix', cost: 2000 },
        { id: 'hex', name: 'Hexagon', cost: 2500 },
        { id: 'spike', name: 'Spike', cost: 3000 },
        { id: 'skull', name: 'Skull', cost: 5000 },
        { id: 'crystal', name: 'Crystal', cost: 6000 },
        { id: 'gear', name: 'Gear', cost: 7000 },
        { id: 'orb', name: 'Orb', cost: 8000 },
        { id: 'diamond', name: 'Diamond', cost: 9000 }
      ]
    }
  ];

  const renderProgressBar = (current: number, min: number, max: number, step: number) => {
    const totalSegments = Math.ceil((max - min) / step);
    const filledSegments = Math.ceil((current - min) / step);
    return (
      <div className="flex gap-1 mt-2">
        {Array.from({ length: totalSegments }).map((_, i) => (
          <div 
            key={i} 
            className={`h-2 flex-1 rounded-sm transition-colors ${i < filledSegments ? 'bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.5)]' : 'bg-gray-800'}`} 
          />
        ))}
      </div>
    );
  };

  const handleRespec = () => {
    if (confirm("Reboot System? This will refund all stat upgrades at a 10% penalty.")) {
      store.respecUpgrades();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, rotateX: 15 }}
      animate={{ opacity: 1, scale: 1, rotateX: 0 }}
      exit={{ opacity: 0, scale: 0.95, rotateX: -15 }}
      style={{ perspective: 1500 }}
      className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[#050510]/80 backdrop-blur-md"
    >
      <div className="flex max-h-[90vh] min-h-[600px] w-[950px] flex-col overflow-hidden sci-fi-panel hologram-card shadow-[0_0_60px_rgba(168,85,247,0.15)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/30 p-6 bg-cyan-950/20">
          <div className="flex items-center gap-6">
            <h2 className="text-3xl font-black tracking-widest text-cyan-400 neon-text-cyan flex items-center gap-3">
              <Zap className="text-cyan-400" />
              UPGRADES
            </h2>
            <div className="flex bg-[#050510] p-1 sci-fi-button border border-white/10">
              {['stats', 'augments', 'cosmetics'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-4 py-1.5 uppercase tracking-widest text-[11px] font-black transition-all sci-fi-button ${activeTab === tab ? 'bg-cyan-500 text-[#050510] shadow-[0_0_15px_rgba(34,211,238,0.5)]' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-2xl font-black text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] px-4 py-1.5 sci-fi-panel border-b-2 border-yellow-400">${store.points.toLocaleString()}</div>
            <button onClick={onClose} className="sci-fi-button bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/50 px-6 py-2 font-black tracking-widest transition-all">CLOSE</button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'stats' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold text-cyan-400">HARDWARE UPGRADES</h3>
                <button 
                  onClick={handleRespec}
                  className="text-xs font-bold px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/40 transition-colors"
                >
                  REBOOT SYSTEM (RESPEC)
                </button>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {upgrades.map(u => (
                  <motion.div key={u.id} className="flex flex-col sci-fi-panel border-l-4 border-cyan-400 p-4 relative overflow-hidden group hologram-card"
                    whileHover={{ scale: 1.02, rotateX: 2, rotateY: -2 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="absolute inset-0 bg-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.3)]">{u.icon}</div>
                        <div>
                          <div className="font-black tracking-widest uppercase text-white">{u.name}</div>
                          <div className="text-xs font-bold text-gray-400 font-mono">PWR LEVEL: {u.current.toFixed(1)}</div>
                        </div>
                      </div>
                      <button
                        disabled={store.points < u.cost || u.current >= u.max}
                        onClick={() => store.buyUpgrade(u.id, u.cost, u.current + u.step)}
                        className="flex flex-col items-center sci-fi-button bg-cyan-500/20 border border-cyan-500/50 px-4 py-2 font-black tracking-widest text-cyan-400 transition-all hover:bg-cyan-500 hover:text-[#050510] hover:shadow-[0_0_15px_rgba(34,211,238,0.8)] disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <span className="text-[10px]">UPGRADE</span>
                        <span className="text-sm text-yellow-400 drop-shadow-md">${u.cost}</span>
                      </button>
                    </div>
                    <div className="w-full relative z-10">
                       {renderProgressBar(u.current, u.min, u.max, u.step)}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'augments' && (
            <div className="flex flex-col gap-6">
              <h3 className="text-xl font-bold text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.3)]">COMBAT AUGMENTS</h3>
              <p className="text-sm text-gray-400 -mt-4">Permanent gameplay altering microchips.</p>
              <div className="grid grid-cols-1 gap-4">
                {augmentsData.map(aug => {
                  const isOwned = store.augments.includes(aug.id);
                  return (
                    <motion.div key={aug.id} className={`flex items-center justify-between sci-fi-panel p-4 transition-all hologram-card ${isOwned ? 'border-l-4 border-l-red-500 bg-red-950/30' : 'border-l-4 border-l-gray-600'}`}
                      whileHover={{ scale: 1.01, x: 5 }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${isOwned ? 'bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(248,113,113,0.5)]' : 'bg-gray-800 text-gray-500'}`}>
                          {aug.icon}
                        </div>
                        <div>
                          <div className={`font-black uppercase tracking-widest text-lg ${isOwned ? 'text-red-400 neon-text-red' : 'text-gray-300'}`}>{aug.name}</div>
                          <div className="text-xs font-bold text-gray-400 uppercase font-mono">{aug.desc}</div>
                        </div>
                      </div>
                      {isOwned ? (
                        <div className="px-6 py-2 font-black tracking-widest text-xs sci-fi-button border border-red-500 bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)]">INSTALLED</div>
                      ) : (
                        <button
                          disabled={store.points < aug.cost}
                          onClick={() => store.buyUpgrade('augment', aug.cost, aug.id)}
                          className="flex flex-col items-center sci-fi-button border border-red-500/50 bg-red-500/20 px-6 py-2 font-black tracking-widest text-red-400 transition-all hover:bg-red-500 hover:text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.8)] disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <span className="text-[10px]">INSTALL</span>
                          <span className="text-sm text-yellow-400 drop-shadow-md">${aug.cost}</span>
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'cosmetics' && (
            <div>
              <h3 className="mb-6 text-xl font-bold text-purple-400">COSMETIC OVERRIDES</h3>
              <div className="flex flex-col gap-8">
                {cosmetics.map(c => (
                  <div key={c.category}>
                    <div className="mb-3 text-sm font-bold tracking-widest text-gray-400 border-b border-white/10 pb-2">{c.name.toUpperCase()}</div>
                    <div className="grid grid-cols-4 gap-4">
                      {c.items.map(item => {
                        // @ts-ignore
                        const isOwned = store[c.category] === item.id || item.cost === 0;
                        // @ts-ignore
                        const isEquipped = store[c.category] === item.id;
                        
                        return (
                          <motion.button
                            key={item.id}
                            whileHover={isEquipped ? {} : { scale: 1.05, rotateY: 5, rotateX: 5 }}
                            disabled={!isOwned && store.points < item.cost}
                            onClick={() => {
                              if (isOwned) {
                                store.setStats({ [c.category]: item.id });
                              } else {
                                store.buyUpgrade(c.category, item.cost, item.id);
                              }
                            }}
                            className={`flex flex-col items-center justify-center sci-fi-panel p-4 transition-all relative overflow-hidden hologram-card ${
                              isEquipped 
                                ? 'border-b-4 border-b-purple-500 bg-purple-900/40 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.4)]' 
                                : isOwned
                                  ? 'border-white/20 bg-white/5 text-gray-300 hover:bg-white/10 hover:border-purple-400/50'
                                  : 'border-white/10 bg-black/60 text-gray-500 hover:border-white/30'
                            }`}
                          >
                            <div className="font-black uppercase tracking-widest text-[11px] text-center mb-1">{item.name}</div>
                            {!isOwned && <div className="text-sm font-black text-yellow-400 drop-shadow-md">${item.cost}</div>}
                            {isEquipped && <div className="absolute top-0 left-0 w-full text-center bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-[9px] font-black tracking-widest uppercase py-0.5">ACTIVE</div>}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
