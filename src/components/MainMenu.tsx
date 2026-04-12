import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useGameStore, MapDesign } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Map, Swords, ChevronDown, ChevronUp, Sparkles, Plus, Minus, Shuffle, Play, User, Bot, Crosshair, Shield, Zap, Anchor } from 'lucide-react';

// ─── Animated Background Particles ───────────────────────────────
const Particle = ({ delay, duration, size, left, top }: { delay: number; duration: number; size: number; left: string; top: string }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: size,
      height: size,
      left,
      top,
      background: `radial-gradient(circle, rgba(34,211,238,0.4) 0%, rgba(34,211,238,0) 70%)`,
    }}
    animate={{
      y: [0, -40, 0],
      opacity: [0, 0.6, 0],
      scale: [0.5, 1.2, 0.5],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  />
);

const BackgroundParticles = React.memo(() => {
  const particles = useMemo(() => 
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      delay: Math.random() * 5,
      duration: 4 + Math.random() * 4,
      size: 4 + Math.random() * 8,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
    })), []
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map(p => <Particle key={p.id} {...p} />)}
    </div>
  );
});

// ─── Animated Grid Background ─────────────────────────────────
const GridBackground = React.memo(() => (
  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }}
    />
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(ellipse 80% 50% at 50% 50%, rgba(34,211,238,0.06) 0%, transparent 70%)`,
      }}
    />
  </div>
));

// ─── Counter Button ──────────────────────────────────────────
const CounterButton = ({ value, onChange, min = 0, max = 4, label, icon: Icon }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-gray-400" />
      <span className="text-sm text-gray-300 font-medium">{label}</span>
    </div>
    <div className="flex items-center gap-1">
      <motion.button
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.1 }}
        className="w-7 h-7 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Minus size={12} />
      </motion.button>
      <div className="w-8 text-center font-bold text-white tabular-nums text-lg">{value}</div>
      <motion.button
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.1 }}
        className="w-7 h-7 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Plus size={12} />
      </motion.button>
    </div>
  </div>
);

// ─── Theme Data ─────────────────────────────────────────────
const mapData: Record<MapDesign, { emoji: string; gradient: string; accent: string; bgPreview: string; description: string; darkText: boolean }> = {
  'The Pit': {
    emoji: '⚔️',
    gradient: 'from-orange-500 to-red-600',
    accent: 'rgba(239,68,68,0.5)',
    bgPreview: 'linear-gradient(135deg, #1a0f0a 0%, #2e0d0d 50%, #280909 100%)',
    description: 'Elevated bases sloping down into a dense central arena',
    darkText: false,
  },
  'Crossfire': {
    emoji: '🌉',
    gradient: 'from-blue-500 to-indigo-600',
    accent: 'rgba(99,102,241,0.5)',
    bgPreview: 'linear-gradient(135deg, #0a1128 0%, #0a1930 50%, #050a1f 100%)',
    description: 'Elevated corner islands connected by crossing bridges',
    darkText: false,
  },
  'Highrise': {
    emoji: '🏙️',
    gradient: 'from-cyan-300 to-sky-500',
    accent: 'rgba(56,189,248,0.5)',
    bgPreview: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    description: 'A towering central structure surrounded by lower elevated platforms',
    darkText: false,
  },
  'Fortress': {
    emoji: '🏰',
    gradient: 'from-emerald-600 to-teal-800',
    accent: 'rgba(20,184,166,0.5)',
    bgPreview: 'linear-gradient(135deg, #061a14 0%, #0f3028 50%, #091e14 100%)',
    description: 'Thick defensive walls and narrow choke points guiding into the center',
    darkText: false,
  },
  'Orbital': {
    emoji: '🪐',
    gradient: 'from-fuchsia-500 to-purple-600',
    accent: 'rgba(217,70,239,0.5)',
    bgPreview: 'linear-gradient(135deg, #180524 0%, #290a3d 50%, #150221 100%)',
    description: 'A suspended zero-G array with rotating metallic gyroscopes',
    darkText: false,
  },
  'Volcano': {
    emoji: '🌋',
    gradient: 'from-red-600 to-yellow-500',
    accent: 'rgba(239,68,68,0.5)',
    bgPreview: 'linear-gradient(135deg, #260707 0%, #3d140a 50%, #1a0404 100%)',
    description: 'A treacherous central peak surrounded by rivers of flowing magma',
    darkText: false,
  },
};


const teamColors = ['#22d3ee', '#ff3333', '#33ff33', '#ffff33'];

// ─── Section Header ──────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; subtitle: string }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/20">
      <Icon size={20} className="text-cyan-400" />
    </div>
    <div>
      <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  </div>
);

// ─── Main Menu Component ──────────────────────────────────────
export const MainMenu: React.FC = () => {
  const { teams, mapConfig, playerName, setStats, startGame, hookTip, chainLink } = useGameStore();
  const [activeSection, setActiveSection] = useState<'teams' | 'map'>('teams');

  const updateTeam = useCallback((id: number, field: 'playerCount' | 'aiCount', value: number) => {
    const newTeams = teams.map(t => t.id === id ? { ...t, [field]: Math.max(0, Math.min(4, value)) } : t);
    setStats({ teams: newTeams });
  }, [teams, setStats]);

  const updateMap = useCallback((field: 'density' | 'size' | 'theme' | 'startPoints', value: any) => {
    setStats({ mapConfig: { ...mapConfig, [field]: value } });
  }, [mapConfig, setStats]);

  const removeTeam = useCallback((id: number) => {
    if (teams.length <= 2) return;
    setStats({ teams: teams.filter(t => t.id !== id) });
  }, [teams, setStats]);

  const addTeam = useCallback(() => {
    if (teams.length >= 4) return;
    const newId = Math.max(...teams.map(t => t.id)) + 1;
    setStats({
      teams: [
        ...teams,
        { id: newId, color: teamColors[teams.length], playerCount: 0, aiCount: 1, basePosition: [0, 0, 0] },
      ],
    });
  }, [teams, setStats]);

  const totalPlayers = teams.reduce((sum, t) => sum + t.playerCount + t.aiCount, 0);

  const mapDesigns: MapDesign[] = ['The Pit', 'Crossfire', 'Highrise', 'Fortress', 'Orbital', 'Volcano'];

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center bg-[#050510] text-white overflow-hidden select-none"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
    >
      <div className="animate-scanline" />
      <BackgroundParticles />
      <GridBackground />

      {/* ─── Sticky Top Bar: Title + Start ─── */}
      <div className="sticky top-0 z-50 w-full flex flex-col items-center pt-6 pb-4 px-4"
        style={{
          background: 'linear-gradient(to bottom, #050510 60%, transparent 100%)',
        }}
      >
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-4"
        >
          <h1 className="text-5xl font-black tracking-tight glitch-hover neon-text-cyan"
            style={{
              background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 40%, #a855f7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            CHAIN HOOK ARENA
          </h1>
          <p className="text-gray-500 text-sm mt-1 tracking-widest uppercase font-medium">Configure Your Battle</p>
        </motion.div>

        {/* Start Game Button - Always Visible */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={startGame}
          className="sci-fi-button relative group w-full max-w-md py-4 px-8 font-black text-lg tracking-widest uppercase overflow-hidden hologram-card cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(34,211,238,0.2) 0%, rgba(59,130,246,0.2) 100%)',
          }}
        >
          {/* Button glow effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'linear-gradient(135deg, rgba(34,211,238,0.3) 0%, rgba(59,130,246,0.3) 100%)',
            }}
          />
          {/* Shimmer */}
          <motion.div
            className="absolute inset-0 opacity-30"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
            }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
          {/* Border glow */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              boxShadow: '0 0 30px rgba(34,211,238,0.3), inset 0 0 30px rgba(34,211,238,0.1)',
            }}
          />
          <div className="relative z-10 flex items-center justify-center gap-3">
            <Play size={22} className="text-cyan-400" fill="currentColor" />
            <span className="text-cyan-300">DEPLOY TO ARENA</span>
          </div>
          {/* Stats summary under button */}
          <div className="relative z-10 mt-1.5 text-[11px] text-gray-400 font-medium tracking-wider">
            {totalPlayers} combatants • {mapConfig.size}×{mapConfig.size} arena • {mapConfig.theme}
          </div>
        </motion.button>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="w-full max-w-3xl px-4 mb-4 z-10">
        <div className="flex gap-2 p-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
          {[
            { id: 'teams' as const, label: 'Teams & Players', icon: Users },
            { id: 'map' as const, label: 'Map Settings', icon: Map },
          ].map(tab => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                activeSection === tab.id
                  ? 'bg-white/[0.08] text-white border border-white/10 shadow-lg'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border border-transparent'
              }`}
              whileTap={{ scale: 0.97 }}
            >
              <tab.icon size={16} className={activeSection === tab.id ? 'text-cyan-400' : ''} />
              {tab.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ─── Content Area ─── */}
      <div className="flex-1 w-full max-w-3xl px-4 pb-8 overflow-y-auto z-10 scrollbar-thin">
        <AnimatePresence mode="wait">
          {activeSection === 'teams' && (
            <motion.div
              key="teams"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              {/* Player Identity Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6 p-5 sci-fi-panel hologram-card"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/20">
                    <User size={18} className="text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">YOUR IDENTITY</h3>
                    <p className="text-[11px] text-gray-500">Choose your callsign</p>
                  </div>
                </div>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setStats({ playerName: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-medium text-lg focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder-gray-600"
                  placeholder="Enter callsign..."
                  maxLength={16}
                />
              </motion.div>

              {/* Teams Section */}
              <SectionHeader icon={Swords} title="TEAM ROSTER" subtitle="Configure factions and combatants" />
              
              <div className="grid gap-4 mb-4">
                {teams.map((team, index) => (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.08 }}
                    className="relative group sci-fi-panel overflow-hidden transition-all hover:border-white/30"
                    style={{
                      borderColor: `${team.color}40`,
                    }}
                  >
                    {/* Team color accent strip */}
                    <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${team.color}, transparent)` }} />
                    
                    {/* Subtle bg glow */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: `radial-gradient(ellipse at top, ${team.color}08, transparent 70%)` }}
                    />

                    <div className="relative p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg border"
                            style={{
                              background: `${team.color}15`,
                              borderColor: `${team.color}30`,
                              color: team.color,
                              boxShadow: `0 0 20px ${team.color}15`,
                            }}
                          >
                            {team.id}
                          </div>
                          <div>
                            <div className="font-bold text-white">Team {team.id}</div>
                            <div className="text-[11px] text-gray-500">{team.playerCount + team.aiCount} {team.playerCount + team.aiCount === 1 ? 'member' : 'members'}</div>
                          </div>
                        </div>
                        {teams.length > 2 && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => removeTeam(team.id)}
                            className="text-gray-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10 cursor-pointer"
                          >
                            <span className="text-xs font-bold">✕</span>
                          </motion.button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <CounterButton
                          value={team.playerCount}
                          onChange={(v) => updateTeam(team.id, 'playerCount', v)}
                          label="Players"
                          icon={User}
                        />
                        <CounterButton
                          value={team.aiCount}
                          onChange={(v) => updateTeam(team.id, 'aiCount', v)}
                          label="AI Bots"
                          icon={Bot}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Add Team Button */}
              {teams.length < 4 && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-white/[0.08] text-gray-500 hover:text-gray-300 hover:border-white/20 transition-all flex items-center justify-center gap-2 font-medium cursor-pointer"
                  onClick={addTeam}
                >
                  <Plus size={18} />
                  <span>Add Team ({teams.length}/4)</span>
                </motion.button>
              )}
            </motion.div>
          )}

          {activeSection === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <SectionHeader icon={Map} title="ARENA GENERATION" subtitle="Customize the battlefield" />

              {/* Map Selector */}
              <div className="mb-6">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">SELECT MAP DESIGN</div>
                <div className="grid grid-cols-2 gap-3">
                  {mapDesigns.map((t, i) => {
                    const data = mapData[t];
                    const isSelected = mapConfig.theme === t;
                    return (
                      <motion.button
                        key={t}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.06 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => updateMap('theme', t)}
                        className={`relative overflow-hidden sci-fi-button p-4 text-left transition-all duration-300 cursor-pointer border ${
                          isSelected
                            ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]'
                            : 'border-white/[0.06] hover:border-white/30 hologram-card'
                        }`}
                        style={{
                          background: data.bgPreview,
                          boxShadow: isSelected ? `0 0 40px ${data.accent}` : undefined,
                        }}
                      >
                        {/* Selected indicator */}
                        {isSelected && (
                          <motion.div
                            layoutId="themeIndicator"
                            className="absolute inset-0 border-2 rounded-2xl"
                            style={{ borderColor: `${data.accent}` }}
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                          />
                        )}
                        <div className="relative z-10">
                          <div className="text-2xl mb-2">{data.emoji}</div>
                          <div className={`text-sm font-bold ${data.darkText ? 'text-gray-800' : isSelected ? 'text-white' : 'text-gray-300'}`}>{t}</div>
                          <div className={`text-[11px] mt-0.5 ${data.darkText ? 'text-gray-600' : 'text-gray-400'}`}>{data.description}</div>
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-3 right-3 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center"
                          >
                            <span className="text-[10px] text-white font-bold">✓</span>
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Arena Size */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-5 p-5 sci-fi-panel"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold text-white">Arena Size</div>
                    <div className="text-[11px] text-gray-500">Larger arenas spread combatants further apart</div>
                  </div>
                  <div className="text-lg font-black text-cyan-400 tabular-nums px-3 py-1 rounded-lg bg-cyan-400/10 border border-cyan-400/20">
                    {mapConfig.size}×{mapConfig.size}
                  </div>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  step="10"
                  value={mapConfig.size}
                  onChange={(e) => updateMap('size', parseInt(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #22d3ee ${((mapConfig.size - 30) / 70) * 100}%, rgba(255,255,255,0.08) ${((mapConfig.size - 30) / 70) * 100}%)`,
                  }}
                />
                <div className="flex justify-between mt-1.5 text-[10px] text-gray-600 font-medium">
                  <span>30</span>
                  <span>COMPACT ← → EXPANSIVE</span>
                  <span>100</span>
                </div>
              </motion.div>

              {/* Obstacle Density */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mb-5 p-5 sci-fi-panel"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold text-white">Obstacle Density</div>
                    <div className="text-[11px] text-gray-500">Higher density creates more cover and choke points</div>
                  </div>
                  <div className="text-lg font-black text-purple-400 tabular-nums px-3 py-1 rounded-lg bg-purple-400/10 border border-purple-400/20">
                    {Math.round(mapConfig.density * 100)}%
                  </div>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.35"
                  step="0.05"
                  value={mapConfig.density}
                  onChange={(e) => updateMap('density', parseFloat(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #a855f7 ${((mapConfig.density - 0.05) / 0.3) * 100}%, rgba(255,255,255,0.08) ${((mapConfig.density - 0.05) / 0.3) * 100}%)`,
                  }}
                />
                <div className="flex justify-between mt-1.5 text-[10px] text-gray-600 font-medium">
                  <span>5%</span>
                  <span>SPARSE ← → DENSE</span>
                  <span>35%</span>
                </div>
              </motion.div>

              {/* Starting Gold */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 }}
                className="mb-5 p-5 sci-fi-panel"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold text-white">Starting Gold</div>
                    <div className="text-[11px] text-gray-500">Grant combatants early upgrade advantages</div>
                  </div>
                  <div className="text-lg font-black text-yellow-400 tabular-nums px-3 py-1 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                    {mapConfig.startPoints.toLocaleString()}
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200000"
                  step="5000"
                  value={mapConfig.startPoints}
                  onChange={(e) => updateMap('startPoints', parseInt(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #eab308 ${(mapConfig.startPoints / 200000) * 100}%, rgba(255,255,255,0.08) ${(mapConfig.startPoints / 200000) * 100}%)`,
                  }}
                />
                <div className="flex justify-between mt-1.5 text-[10px] text-gray-600 font-medium">
                  <span>0</span>
                  <span>POOR ← → WEALTHY</span>
                  <span>200,000</span>
                </div>
              </motion.div>

              {/* Randomize Seed */}
              <motion.button
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-gray-400 hover:text-white transition-all flex items-center justify-center gap-2 font-medium cursor-pointer"
                onClick={() => setStats({ mapConfig: { ...mapConfig, seed: Math.random() } })}
              >
                <Shuffle size={16} />
                <span>Randomize Layout</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-20"
        style={{ background: 'linear-gradient(to top, #050510 0%, transparent 100%)' }}
      />
    </div>
  );
};
