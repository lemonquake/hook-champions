import React, { useState, useEffect } from 'react';
import { useGameStore, EnemyData } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, Skull, Target, Shield, Zap, Anchor, Scissors, Box, Circle, Cylinder } from 'lucide-react';

export const UI: React.FC = () => {
  const { hp, maxHp, cooldown, hookLength, hookSpeed, retractSpeed, moveSpeed, status, respawnTimer, points } = useGameStore();
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
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex h-8 w-8 items-center justify-center">
            <div className="absolute h-1 w-1 rounded-full bg-white" />
            <div className="absolute h-full w-[2px] bg-white/50" />
            <div className="absolute h-[2px] w-full bg-white/50" />
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex w-full justify-between p-6">
        <div className="flex flex-col gap-2">
          <div className="text-4xl font-black tracking-tighter text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
            {status === 'alive' ? `${Math.ceil(hp)} / ${maxHp} HP` : 'DEAD'}
          </div>
          {status === 'alive' && (
            <div className="flex items-center gap-3">
              <div className="text-sm font-bold uppercase tracking-widest text-gray-400">Cooldown</div>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-800">
                <div 
                  className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all duration-100"
                  style={{ width: `${Math.max(0, 100 - (cooldown / 2) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Multiplayer Active</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]">
            ${points}
          </div>
          <div className="text-sm text-gray-400">Press [U] for Upgrades</div>
          <div className="text-sm text-gray-400">Hold [TAB] for Scoreboard</div>
        </div>
      </div>

      {/* Death Overlay */}
      <AnimatePresence>
        {status === 'dead' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-sm"
          >
            <h1 className="text-6xl font-black text-red-500 mb-4">YOU DIED</h1>
            <p className="text-2xl text-white">Respawning in {Math.ceil(respawnTimer)}s...</p>
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

      {/* Bottom Stats */}
      <div className="flex w-full justify-between bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
        <div className="flex gap-8">
          <StatBox label="Hook Length" value={`${hookLength}m`} />
          <StatBox label="Hook Speed" value={`${hookSpeed.toFixed(1)}m/s`} />
          <StatBox label="Retract Speed" value={`${retractSpeed.toFixed(1)}m/s`} />
          <StatBox label="Move Speed" value={`${moveSpeed}m/s`} />
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col border-l-2 border-cyan-500/30 pl-3">
    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/70">{label}</span>
    <span className="text-2xl font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{value}</span>
  </div>
);

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
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute left-1/2 top-24 w-[800px] -translate-x-1/2 rounded-xl border border-white/10 bg-black/80 p-6 backdrop-blur-md"
    >
      <h2 className="mb-6 text-center text-2xl font-black tracking-widest text-white">SCOREBOARD</h2>
      
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
              className={`grid grid-cols-6 gap-4 rounded-lg px-4 py-2 items-center ${p.id === 'player' ? 'bg-white/10' : ''}`}
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] min-h-[500px] w-[800px] flex-col overflow-hidden rounded-2xl border border-cyan-500/30 bg-gray-950 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-6 bg-gray-900/50">
          <div className="flex items-center gap-6">
            <h2 className="text-3xl font-black tracking-widest text-white">UPGRADES</h2>
            <div className="flex bg-black/50 p-1 rounded-lg">
              {['stats', 'augments', 'cosmetics'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-4 py-1.5 rounded uppercase text-sm font-bold transition-all ${activeTab === tab ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">${store.points}</div>
            <button onClick={onClose} className="rounded bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20 transition-colors">CLOSE</button>
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
                  <div key={u.id} className="flex flex-col rounded-lg border border-white/10 bg-white/5 p-4 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.3)]">{u.icon}</div>
                        <div>
                          <div className="font-bold text-white">{u.name}</div>
                          <div className="text-sm text-gray-400">Current: {u.current.toFixed(1)}</div>
                        </div>
                      </div>
                      <button
                        disabled={store.points < u.cost || u.current >= u.max}
                        onClick={() => store.buyUpgrade(u.id, u.cost, u.current + u.step)}
                        className="flex flex-col items-center rounded bg-cyan-500/20 px-4 py-2 font-bold text-cyan-400 transition-colors hover:bg-cyan-500/40 disabled:opacity-50 disabled:hover:bg-cyan-500/20"
                      >
                        <span>UPGRADE</span>
                        <span className="text-xs text-yellow-400">${u.cost}</span>
                      </button>
                    </div>
                    <div className="w-full relative z-10">
                       {renderProgressBar(u.current, u.min, u.max, u.step)}
                    </div>
                  </div>
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
                    <div key={aug.id} className={`flex items-center justify-between rounded-lg border p-4 transition-all ${isOwned ? 'border-red-500/50 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${isOwned ? 'bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(248,113,113,0.5)]' : 'bg-gray-800 text-gray-500'}`}>
                          {aug.icon}
                        </div>
                        <div>
                          <div className={`font-bold text-lg ${isOwned ? 'text-white' : 'text-gray-300'}`}>{aug.name}</div>
                          <div className="text-sm text-gray-400">{aug.desc}</div>
                        </div>
                      </div>
                      {isOwned ? (
                        <div className="px-4 py-2 font-bold text-red-400 tracking-widest text-sm border border-red-500/30 rounded bg-red-500/10">INSTALLED</div>
                      ) : (
                        <button
                          disabled={store.points < aug.cost}
                          onClick={() => store.buyUpgrade('augment', aug.cost, aug.id)}
                          className="flex flex-col items-center rounded bg-red-500/20 px-6 py-2 font-bold text-red-400 transition-colors hover:bg-red-500/40 disabled:opacity-50 disabled:hover:bg-red-500/20"
                        >
                          <span>INSTALL</span>
                          <span className="text-xs text-yellow-400">${aug.cost}</span>
                        </button>
                      )}
                    </div>
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
                          <button
                            key={item.id}
                            disabled={!isOwned && store.points < item.cost}
                            onClick={() => {
                              if (isOwned) {
                                store.setStats({ [c.category]: item.id });
                              } else {
                                store.buyUpgrade(c.category, item.cost, item.id);
                              }
                            }}
                            className={`flex flex-col items-center justify-center rounded-xl border p-4 transition-all relative overflow-hidden ${
                              isEquipped 
                                ? 'border-purple-500 bg-purple-500/20 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                                : isOwned
                                  ? 'border-white/20 bg-white/5 text-gray-300 hover:bg-white/10'
                                  : 'border-white/10 bg-black/50 text-gray-500 hover:border-white/30'
                            }`}
                          >
                            <div className="font-bold mb-1">{item.name}</div>
                            {!isOwned && <div className="text-sm font-bold text-yellow-400">${item.cost}</div>}
                            {isEquipped && <div className="absolute bottom-0 w-full text-center bg-purple-500 text-white text-[10px] font-bold py-0.5">EQUIPPED</div>}
                          </button>
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
