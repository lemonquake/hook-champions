import React, { useState, useEffect, useRef } from 'react';
import { useGameStore, EnemyData } from '../store';
import { Crosshair, Skull, Target, Shield, Zap, Anchor, Scissors, Box, Circle, Cylinder } from 'lucide-react';
// @ts-ignore
import anime from 'animejs';

export const UI: React.FC = () => {
  const status = useGameStore(state => state.status);
  const respawnTimer = useGameStore(state => state.respawnTimer);
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
      {/* Top Bar */}
      <div className="flex w-full justify-between p-6">
        <div className="flex flex-col gap-2">
          <TopBarHP />
          <Cooldowns />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 sci-fi-panel px-4 py-1.5 border-r-2 border-green-500">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-green-400">Uplink Active</span>
          </div>
          <PointsDisplay />
          <div className="text-xs font-bold tracking-widest text-gray-400 mt-2 bg-black/40 px-3 py-1 sci-fi-button cursor-default hover:text-white transition-colors">SYSTEM LOG [TAB]</div>
          <div className="text-xs font-bold tracking-widest text-gray-400 bg-black/40 px-3 py-1 sci-fi-button cursor-default hover:text-white transition-colors">BLACK MARKET [U]</div>
        </div>
      </div>

      {/* Central Crosshair Overlay */}
      <EpicCrosshair />

      {/* Death Overlay */}
      {status === 'dead' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md opacity-100 transition-opacity">
          <div className="animate-scanline" />
          <h1 className="text-8xl font-black text-red-500 mb-4 glitch-hover neon-text-red">CRITICAL FAILURE</h1>
          <p className="text-3xl font-bold tracking-widest text-white/80 uppercase">Reboot sequence in {Math.ceil(respawnTimer)}s...</p>
        </div>
      )}

      {/* Floating Damage Overlay */}
      <DamageFeedbacksOverlay />

      {/* Scoreboard */}
      {showScoreboard && <Scoreboard />}

      {/* Upgrades */}
      {showUpgrades && <Upgrades onClose={() => setShowUpgrades(false)} />}

      {/* Kill Celebration Effects */}
      <KillEffectsOverlay />

      {/* Local Telemetry HUD & AI Trainer */}
      <TelemetryHUD />

      {/* Bottom Stats */}
      <BottomStats />
    </div>
  );
};

// ─── Micro Components for performance optimization ───

const TopBarHP = () => {
  const status = useGameStore(state => state.status);
  const hp = useGameStore(state => state.hp);
  const maxHp = useGameStore(state => state.maxHp);
  return (
    <div className="sci-fi-panel px-6 py-2 border-l-4 border-red-500 flex items-center justify-center">
      <div className="text-4xl font-black tracking-tighter text-red-500 neon-text-red" style={{ minWidth: '150px', textAlign: 'center' }}>
        {status === 'alive' ? `${Math.ceil(hp)} / ${maxHp}` : 'DEAD'}
      </div>
    </div>
  );
};

const Cooldowns = () => {
  const status = useGameStore(state => state.status);
  const cooldown = useGameStore(state => state.cooldown);
  const pushHookCooldown = useGameStore(state => state.pushHookCooldown);
  if (status !== 'alive') return null;
  return (
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
  );
};

const PointsDisplay = () => {
  const points = useGameStore(state => state.points);
  return (
    <div className="sci-fi-panel px-6 py-2 border-r-4 border-yellow-400 mt-2">
      <div className="text-3xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,1)]">
        ${points.toLocaleString()}
      </div>
    </div>
  );
};

const BottomStats = () => {
  const hookLength = useGameStore(state => state.hookLength);
  const hookSpeed = useGameStore(state => state.hookSpeed);
  const retractSpeed = useGameStore(state => state.retractSpeed);
  const moveSpeed = useGameStore(state => state.moveSpeed);
  return (
    <div className="flex w-full justify-between bg-gradient-to-t from-[#0a0f18]/80 to-transparent p-6 pt-20">
      <div className="flex gap-4">
        <StatBox label="Hook Length" value={`${hookLength}m`} />
        <StatBox label="Hook Speed" value={`${hookSpeed.toFixed(1)}m/s`} />
        <StatBox label="Retract Speed" value={`${retractSpeed.toFixed(1)}m/s`} />
        <StatBox label="Move Speed" value={`${moveSpeed}m/s`} />
      </div>
    </div>
  );
};

// ─── AI Telemetry HUD ───────────────────────────────────────────────
const TelemetryHUD = () => {
  const store = useGameStore();
  const isRecording = store.isRecording;
  const toggleRecording = store.toggleRecording;
  const pos = store.playerPosition;
  const hp = store.hp;
  const status = store.status;
  const vel = store.playerVelocity;

  // Background Telemetry loop
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      const state = useGameStore.getState();
      const payload = {
        timestamp: Date.now(),
        position: state.playerPosition,
        velocity: state.playerVelocity,
        hp: state.hp,
        status: state.status,
      };
      // Fire and forget POST to Vite telemetry sink
      fetch('/api/telemetry', {
        method: 'POST',
        body: JSON.stringify(payload)
      }).catch(err => {
        // silently fail if network drops
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  return (
    <div className="absolute top-24 left-6 pointer-events-auto flex flex-col gap-2">
      <div className="sci-fi-panel p-4 border-l-4 border-emerald-400 bg-emerald-950/20 backdrop-blur-sm min-w-[250px]">
        <div className="flex items-center justify-between mb-3 border-b border-emerald-500/30 pb-2">
          <span className="text-xs font-black tracking-widest text-emerald-400">TELEMETRY LINK</span>
          <div className="flex items-center gap-2">
            {isRecording && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,1)]" />}
            <button 
              onClick={toggleRecording}
              className={`sci-fi-button px-3 py-1 text-[10px] font-black tracking-widest border transition-all ${isRecording ? 'bg-red-500/20 text-red-500 border-red-500/50 hover:bg-red-500 hover:text-white' : 'bg-green-500/20 text-green-500 border-green-500/50 hover:bg-green-500 hover:text-black'}`}
            >
              {isRecording ? 'STOP REC' : 'RECORD AI PATH'}
            </button>
          </div>
        </div>
        
        <div className="flex flex-col gap-1 text-[11px] font-mono text-emerald-300/80">
          <div className="flex justify-between"><span>X:</span><span className="text-white">{pos[0].toFixed(2)}</span></div>
          <div className="flex justify-between"><span>ELEV Y:</span><span className="text-white">{pos[1].toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Z:</span><span className="text-white">{pos[2].toFixed(2)}</span></div>
          <div className="h-px bg-emerald-500/30 my-1"/>
          <div className="flex justify-between"><span>VEL Y:</span><span className="text-white">{vel[1].toFixed(2)} m/s</span></div>
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
  
  const readyWordRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isReady && readyWordRef.current) {
        anime({
            targets: readyWordRef.current,
            opacity: [1, 0.3, 1],
            duration: 800,
            loop: true,
            easing: 'easeInOutQuad'
        });
    } else {
        anime.remove(readyWordRef.current);
    }
  }, [isReady]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 64, height: 64 }}>
        <svg width="64" height="64" className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <circle cx="32" cy="32" r={radius} fill="none" stroke={isReady ? '#22c55e' : color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            style={{ 
              transition: 'stroke-dashoffset 0.1s linear',
              filter: isReady ? `drop-shadow(0 0 6px rgba(34,197,94,0.8))` : `drop-shadow(0 0 4px ${glowColor})`
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isReady ? (
            <div ref={readyWordRef} className="text-[11px] font-black tracking-wider" style={{ color: '#22c55e', textShadow: '0 0 8px rgba(34,197,94,0.8)' }}>READY</div>
          ) : (
            <div className="text-xl font-black tabular-nums" style={{ color, textShadow: `0 0 6px ${glowColor}` }}>{cooldown.toFixed(1)}</div>
          )}
        </div>
      </div>
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

// ─── Floating Damage Effects (Anime.js) ─────────────────────────
const DamageFeedbacksOverlay: React.FC = () => {
    const feedbacks = useGameStore(state => state.damageFeedbacks);
    const removeFeedback = useGameStore(state => state.removeDamageFeedback);

    return (
        <div className="absolute inset-0 pointer-events-none">
            {feedbacks.map(f => (
                <DamageNode key={f.id} feedback={f} onComplete={() => removeFeedback(f.id)} />
            ))}
        </div>
    );
};

const DamageNode: React.FC<{ feedback: any, onComplete: () => void }> = ({ feedback, onComplete }) => {
    const nodeRef = useRef<HTMLDivElement>(null);
    
    // Convert 3D world pos to rough 2D screen pos (just visual trick for now, or assume center screen if hit)
    // A robust system would project using Three.js Camera, but for now we randomize around center for impact feel
    const startX = 50 + (Math.random() * 20 - 10);
    const startY = 40 + (Math.random() * 20 - 10);
    
    useEffect(() => {
        if (!nodeRef.current) return;
        const xOffset = (Math.random() - 0.5) * 100;
        
        anime({
            targets: nodeRef.current,
            translateY: ['0px', '-100px'],
            translateX: ['0px', `${xOffset}px`],
            scale: feedback.isCrit ? [0, 2, 1] : [0, 1],
            opacity: [1, 1, 0],
            duration: 1500,
            easing: 'easeOutExpo',
            complete: onComplete
        });
    }, [feedback, onComplete]);

    return (
        <div 
            ref={nodeRef} 
            className="absolute font-black transform -translate-x-1/2 -translate-y-1/2"
            style={{ 
                left: `${startX}%`, 
                top: `${startY}%`, 
                color: feedback.color || '#fff', 
                fontSize: feedback.isCrit ? '3rem' : '2rem',
                textShadow: `0 0 10px ${feedback.color || '#fff'}, 0 0 20px ${feedback.color || '#fff'}, 0 0 5px #000`
            }}
        >
            -{Math.round(feedback.amount)}
        </div>
    );
};

// ─── Arena Kill Feed (Epic Animated Kill Announcements) ─────────────────
const KILL_COLORS = [
  { color: '#ef4444', glow: 'rgba(239,68,68,0.8)' },
  { color: '#f97316', glow: 'rgba(249,115,22,0.8)' },
  { color: '#eab308', glow: 'rgba(234,179,8,0.8)' },
  { color: '#a855f7', glow: 'rgba(168,85,247,0.8)' },
  { color: '#22d3ee', glow: 'rgba(34,211,238,0.8)' },
  { color: '#f43f5e', glow: 'rgba(244,63,94,0.8)' },
  { color: '#06b6d4', glow: 'rgba(6,182,212,0.8)' },
  { color: '#10b981', glow: 'rgba(16,185,129,0.8)' },
  { color: '#ec4899', glow: 'rgba(236,72,153,0.8)' },
  { color: '#8b5cf6', glow: 'rgba(139,92,246,0.8)' },
];

const KillEffectsOverlay: React.FC = () => {
  const killFeedEffects = useGameStore(state => state.killFeedEffects);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      killFeedEffects.forEach(e => {
        if (now - e.time > 4000) {
          useGameStore.getState().removeKillEffect(e.id);
        }
      });
    }, 500);
    return () => clearInterval(interval);
  }, [killFeedEffects]);
  
  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex flex-col items-center" style={{ top: '15%' }}>
      {killFeedEffects.slice(-3).map((effect, index) => (
        <ArenaKillBanner key={effect.id} effect={effect} index={index} />
      ))}
    </div>
  );
};

const ArenaKillBanner: React.FC<{ effect: { id: string; variant: number; victimName: string; killerName: string; method: string; message: string; time: number }; index: number }> = ({ effect, index }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const colorScheme = KILL_COLORS[effect.variant % KILL_COLORS.length];
  const animVariant = effect.variant % 5;
  
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const tl = anime.timeline({ easing: 'easeOutExpo' });

    // Screen edge flash
    tl.add({
      targets: el.querySelector('.kill-flash'),
      opacity: [0.6, 0],
      duration: 800,
      easing: 'easeOutQuad'
    });

    // Animation variant selector
    if (animVariant === 0) {
      // ZOOM EXPLODE - text scales from massive to normal with bounce
      tl.add({
        targets: el.querySelector('.kill-message'),
        scale: [5, 1],
        opacity: [0, 1],
        rotate: ['-5deg', '0deg'],
        duration: 600,
        easing: 'spring(1, 80, 12, 0)'
      }, 0);
    } else if (animVariant === 1) {
      // SLIDE FROM LEFT with skew
      tl.add({
        targets: el.querySelector('.kill-message'),
        translateX: ['-120%', '0%'],
        skewX: ['-15deg', '0deg'],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutBack'
      }, 0);
    } else if (animVariant === 2) {
      // DROP FROM TOP with shake
      tl.add({
        targets: el.querySelector('.kill-message'),
        translateY: ['-200px', '0px'],
        opacity: [0, 1],
        duration: 400,
        easing: 'easeOutBounce'
      }, 0);
      tl.add({
        targets: el.querySelector('.kill-message'),
        translateX: [0, -8, 8, -4, 4, 0],
        duration: 300,
        easing: 'easeInOutQuad'
      }, 350);
    } else if (animVariant === 3) {
      // SLIDE FROM RIGHT with rotation
      tl.add({
        targets: el.querySelector('.kill-message'),
        translateX: ['120%', '0%'],
        rotate: ['10deg', '0deg'],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutBack'
      }, 0);
    } else {
      // GLITCH SLAM - rapid scale oscillation then settle
      tl.add({
        targets: el.querySelector('.kill-message'),
        scale: [0, 1.3, 0.8, 1.1, 1],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutElastic(1, .6)'
      }, 0);
    }

    // Decorative lines shooting across
    tl.add({
      targets: el.querySelectorAll('.kill-line-right'),
      translateX: ['-100vw', '100vw'],
      opacity: [1, 0],
      easing: 'easeOutQuad',
      duration: 600,
      delay: anime.stagger(80)
    }, 100);

    tl.add({
      targets: el.querySelectorAll('.kill-line-left'),
      translateX: ['100vw', '-100vw'],
      opacity: [1, 0],
      easing: 'easeOutQuad',
      duration: 600,
      delay: anime.stagger(80)
    }, 150);

    // Particle burst
    tl.add({
      targets: el.querySelectorAll('.kill-particle'),
      translateX: () => (Math.random() - 0.5) * 600,
      translateY: () => (Math.random() - 0.5) * 200,
      scale: [1.5, 0],
      opacity: [1, 0],
      duration: 900,
      easing: 'easeOutExpo'
    }, 0);

    // Fade out after delay
    tl.add({
      targets: el.querySelector('.kill-message'),
      opacity: [1, 0],
      translateY: [0, -30],
      scale: [1, 0.8],
      duration: 600,
      easing: 'easeInQuad'
    }, 2800);

  }, [effect.variant, animVariant]);
  
  return (
    <div ref={containerRef} className="relative w-full flex justify-center" style={{ marginTop: index * 10 }}>
      {/* Screen edge flash */}
      <div className="kill-flash absolute inset-0 opacity-0" style={{ boxShadow: `inset 0 0 100px 20px ${colorScheme.glow}` }} />
      
      {/* Main message */}
      <div className="kill-message opacity-0 relative px-8 py-3 mb-2" style={{ maxWidth: '90vw' }}>
        {/* Background blur plate */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md border-l-4 border-r-4" 
          style={{ borderColor: colorScheme.color, boxShadow: `0 0 30px ${colorScheme.glow}, inset 0 0 20px rgba(0,0,0,0.5)` }} 
        />
        
        {/* Message text */}
        <div className="relative z-10 text-center">
          <div className="text-lg md:text-xl font-black uppercase tracking-wide leading-tight"
            style={{ 
              color: '#ffffff',
              textShadow: `0 0 20px ${colorScheme.glow}, 0 0 40px ${colorScheme.glow}, 0 2px 0 rgba(0,0,0,0.8)`,
            }}
          >
            {effect.message || `${effect.killerName} eliminated ${effect.victimName}!`}
          </div>
        </div>

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: colorScheme.color }} />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: colorScheme.color }} />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: colorScheme.color }} />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: colorScheme.color }} />
      </div>

      {/* Decorative speed lines */}
      {[...Array(2)].map((_, i) => (
        <div key={`r-${i}`} className="kill-line-right absolute h-[2px] opacity-0" 
          style={{ top: `${40 + i * 20}%`, width: '30vw', backgroundColor: colorScheme.color, boxShadow: `0 0 8px ${colorScheme.glow}` }} />
      ))}
      {[...Array(2)].map((_, i) => (
        <div key={`l-${i}`} className="kill-line-left absolute h-[2px] opacity-0 right-0" 
          style={{ top: `${50 + i * 20}%`, width: '30vw', backgroundColor: colorScheme.color, boxShadow: `0 0 8px ${colorScheme.glow}` }} />
      ))}

      {/* Particle burst */}
      <div className="absolute left-1/2 top-1/2 w-0 h-0">
        {[...Array(16)].map((_, i) => (
          <div key={`p-${i}`} className="kill-particle absolute w-2 h-2 opacity-0" 
            style={{ backgroundColor: colorScheme.color, boxShadow: `0 0 6px ${colorScheme.glow}`, transform: 'rotate(45deg)', left: '-4px', top: '-4px' }} 
          />
        ))}
      </div>
    </div>
  );
};

const Scoreboard = () => {
  const { playerName, playerTeamId, kills, deaths, shotsFired, shotsHit, status, respawnTimer, enemies, teams } = useGameStore();
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     if (boardRef.current) {
        anime({
            targets: boardRef.current,
            translateY: [-50, 0],
            opacity: [0, 1],
            scale: [0.95, 1],
            duration: 300,
            easing: 'easeOutElastic(1, .8)'
        });
     }
  }, []);

  const allPlayers = [
    { id: 'player', name: playerName, teamId: playerTeamId, kills, deaths, accuracy: shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0, status, respawnTimer },
    ...(Object.values(enemies) as EnemyData[]).map(e => ({
      id: e.id, name: e.name, teamId: e.teamId, kills: e.kills, deaths: e.deaths, accuracy: e.shotsFired > 0 ? Math.round((e.shotsHit / e.shotsFired) * 100) : 0, status: e.status, respawnTimer: e.respawnTimer
    }))
  ].sort((a, b) => b.kills - a.kills);

  return (
    <div ref={boardRef} className="absolute left-1/2 top-24 w-[850px] -translate-x-1/2 border-t-4 border-cyan-500 bg-[#0a0f18]/90 p-6 backdrop-blur-md sci-fi-panel hologram-card shadow-[0_0_50px_rgba(34,211,238,0.15)] opacity-0">
      <h2 className="mb-6 text-center text-3xl font-black tracking-widest text-cyan-400 neon-text-cyan">COMBAT SCOREBOARD</h2>
      <div className="grid grid-cols-6 gap-4 border-b border-white/20 pb-2 text-sm font-bold text-gray-400">
        <div className="col-span-2">NAME</div>
        <div className="text-center">KILLS</div>
        <div className="text-center">DEATHS</div>
        <div className="text-center">ACCURACY</div>
        <div className="text-right">STATUS</div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {allPlayers.map((p, i) => {
          const team = teams.find(t => t.id === p.teamId);
          return (
            <div key={p.id} className={`sb-row grid grid-cols-6 gap-4 px-4 py-2 items-center mb-2 sci-fi-button transition-all hover:scale-[1.02] ${p.id === 'player' ? 'bg-cyan-500/20 border-cyan-400 shadow-[inset_0_0_15px_rgba(34,211,238,0.2)]' : 'bg-black/40 border-transparent hover:bg-white/10'}`} style={{ borderLeft: `4px solid ${team?.color || '#fff'}` }}>
              <div className="col-span-2 font-bold text-white flex items-center gap-2">
                {p.name} {p.id === 'player' && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">YOU</span>}
              </div>
              <div className="text-center text-lg text-white">{p.kills}</div>
              <div className="text-center text-lg text-gray-400">{p.deaths}</div>
              <div className="text-center text-white">{p.accuracy}%</div>
              <div className="text-right font-bold">{p.status === 'alive' ? <span className="text-green-400">ALIVE</span> : <span className="text-red-500">{Math.ceil(p.respawnTimer)}s</span>}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Simplified Upgrades menu utilizing anime.js entry instead of AnimatePresence
const Upgrades = ({ onClose }: { onClose: () => void }) => {
  const store = useGameStore();
  const [activeTab, setActiveTab] = React.useState<'stats' | 'augments' | 'cosmetics'>('stats');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     if (panelRef.current) {
         anime({
             targets: panelRef.current,
             opacity: [0, 1],
             scale: [0.95, 1],
             rotateX: [15, 0],
             duration: 400,
             easing: 'easeOutElastic(1, .8)'
         });
     }
  }, []);

  const upgrades = [
    { id: 'hookSpeed', name: 'Hook Speed', icon: <Zap size={20} />, cost: 200, current: store.hookSpeed, min: 22.5, step: 5, max: 50 },
    { id: 'retractSpeed', name: 'Retract Speed', icon: <Anchor size={20} />, cost: 250, current: store.retractSpeed, min: 17.14 * 1.3, step: 5, max: 50 },
    { id: 'maxHookLength', name: 'Hook Length', icon: <Target size={20} />, cost: 150, current: store.maxHookLength, min: 30, step: 10, max: 100 },
    { id: 'maxHp', name: 'Max HP', icon: <Shield size={20} />, cost: 300, current: store.maxHp, min: 100, step: 50, max: 500 },
  ];

  return (
    <div ref={panelRef} style={{ perspective: 1500 }} className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[#050510]/80 backdrop-blur-md opacity-0">
      <div className="flex max-h-[90vh] min-h-[600px] w-[950px] flex-col overflow-hidden sci-fi-panel hologram-card shadow-[0_0_60px_rgba(168,85,247,0.15)] bg-black">
        {/* Header content similar to original, stripped motion divs */}
        <div className="flex items-center justify-between border-b border-cyan-500/30 p-6 bg-cyan-950/20">
          <div className="flex items-center gap-6">
            <h2 className="text-3xl font-black tracking-widest text-cyan-400 neon-text-cyan flex items-center gap-3">UPGRADES</h2>
            <div className="flex bg-[#050510] p-1 sci-fi-button border border-white/10">
              {['stats', 'augments'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-1.5 uppercase tracking-widest text-[11px] font-black transition-all sci-fi-button ${activeTab === tab ? 'bg-cyan-500 text-[#050510]' : 'text-gray-500'}`}>{tab}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-2xl font-black text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] px-4 py-1.5 sci-fi-panel border-b-2 border-yellow-400">${store.points.toLocaleString()}</div>
             <button onClick={onClose} className="sci-fi-button bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/50 px-6 py-2 font-black tracking-widest transition-all">CLOSE</button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-white">
          {activeTab === 'stats' && (
            <div className="grid grid-cols-2 gap-6">
              {upgrades.map(u => (
                <div key={u.id} className="flex flex-col sci-fi-panel border-l-4 border-cyan-400 p-4 relative overflow-hidden group hologram-card">
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
                      className="flex flex-col items-center sci-fi-button bg-cyan-500/20 border border-cyan-500/50 px-4 py-2 font-black tracking-widest text-cyan-400 transition-all hover:bg-cyan-500 hover:text-[#050510] disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <span className="text-[10px]">UPGRADE</span>
                      <span className="text-sm text-yellow-400 drop-shadow-md">${u.cost}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'augments' && <div className="text-center text-gray-500 p-10">Augments offline for maintenance.</div>}
        </div>
      </div>
    </div>
  );
};

// ─── EPIC CROSSHAIR ────────────────────────────────────────────────────────────
const EpicCrosshair = () => {
  const isLocked = useGameStore(state => state.crosshairTargetLock);
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRingRef = useRef<SVGSVGElement>(null);
  const innerRingRef = useRef<SVGSVGElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const bracketsRef = useRef<HTMLDivElement>(null);

  // Setup continuous idle animations
  useEffect(() => {
    if (!outerRingRef.current || !innerRingRef.current) return;
    
    // Idle rotation
    const outerAnim = anime({
      targets: outerRingRef.current,
      rotate: '1turn',
      duration: 10000,
      easing: 'linear',
      loop: true
    });
    
    const innerAnim = anime({
      targets: innerRingRef.current,
      rotate: '-1turn',
      duration: 8000,
      easing: 'linear',
      loop: true
    });

    return () => {
      outerAnim.pause();
      innerAnim.pause();
    };
  }, []);

  // Handle Target Lock animation state
  useEffect(() => {
    if (!containerRef.current || !bracketsRef.current || !coreRef.current || !outerRingRef.current || !innerRingRef.current) return;

    if (isLocked) {
      // VIOLENT LOCK ON
      anime.remove([containerRef.current, bracketsRef.current, coreRef.current, outerRingRef.current, innerRingRef.current]);
      
      const tl = anime.timeline({ easing: 'easeOutElastic(1, .5)' });
      
      // Core pulse
      tl.add({
        targets: coreRef.current,
        scale: [1, 2.5],
        opacity: [0.8, 1],
        backgroundColor: '#ef4444',
        boxShadow: '0 0 20px 5px rgba(239,68,68,1)',
        duration: 300
      }, 0);

      // Rings turn red and snap
      tl.add({
        targets: [outerRingRef.current, innerRingRef.current],
        stroke: '#ef4444',
        scale: [1, 0.7],
        filter: 'drop-shadow(0 0 10px rgba(239,68,68,1))',
        duration: 400
      }, 0);

      // Brackets slam inwards
      tl.add({
        targets: bracketsRef.current.children,
        translateY: (el, i) => i === 0 || i === 1 ? '10px' : '-10px',
        translateX: (el, i) => i === 0 || i === 2 ? '10px' : '-10px',
        borderColor: '#ef4444',
        boxShadow: '0 0 15px rgba(239,68,68,0.8)',
        duration: 300
      }, 0);

      // Continuous violent shake and pulse while locked
      anime({
        targets: containerRef.current,
        scale: [1, 1.05, 0.95, 1.02, 1],
        rotate: [-1, 1, -1, 1, 0],
        duration: 200,
        direction: 'alternate',
        loop: true,
        easing: 'easeInOutSine'
      });

    } else {
      // RETURN TO IDLE
      anime.remove([containerRef.current, bracketsRef.current, coreRef.current, outerRingRef.current, innerRingRef.current]);
      
      // Normalize container position/scale
      anime({
        targets: containerRef.current,
        scale: 1,
        rotate: 0,
        duration: 400,
        easing: 'easeOutQuad'
      });

      anime({
        targets: coreRef.current,
        scale: 1,
        opacity: 0.8,
        backgroundColor: '#22d3ee',
        boxShadow: '0 0 8px 1px rgba(34,211,238,0.6)',
        duration: 500,
        easing: 'easeOutQuad'
      });

      anime({
        targets: [outerRingRef.current, innerRingRef.current],
        stroke: '#22d3ee',
        scale: 1,
        filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.5))',
        duration: 500,
        easing: 'easeOutQuad'
      });

      // Brackets return to outer positions
      anime({
        targets: bracketsRef.current.children,
        translateY: '0px',
        translateX: '0px',
        borderColor: '#22d3ee',
        boxShadow: '0 0 0px rgba(34,211,238,0)',
        duration: 500,
        easing: 'easeOutQuad'
      });
    }
  }, [isLocked]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
      <div ref={containerRef} className="relative flex items-center justify-center w-24 h-24">
        
        {/* Core Dot */}
        <div ref={coreRef} className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-80" style={{ boxShadow: '0 0 8px 1px rgba(34,211,238,0.6)' }} />
        
        {/* Outer Tech Ring */}
        <svg ref={outerRingRef} viewBox="0 0 100 100" className="absolute w-16 h-16 opacity-70" stroke="#22d3ee" fill="none" strokeWidth="2" strokeDasharray="5 15 20 15">
          <circle cx="50" cy="50" r="45" />
          <circle cx="50" cy="50" r="48" strokeWidth="0.5" strokeOpacity="0.5" strokeDasharray="2 4" />
        </svg>

        {/* Inner Solid Ring */}
        <svg ref={innerRingRef} viewBox="0 0 100 100" className="absolute w-10 h-10 opacity-70" stroke="#22d3ee" fill="none" strokeWidth="1.5" strokeDasharray="30 10">
          <circle cx="50" cy="50" r="45" />
          {/* Inner tick marks */}
          <path d="M50 0 L50 10 M50 90 L50 100 M0 50 L10 50 M90 50 L100 50" strokeWidth="3" />
        </svg>

        {/* 4 Corner Brackets that slam inward */}
        <div ref={bracketsRef} className="absolute inset-0">
          {/* Top Left */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400 opacity-60" />
          {/* Top Right */}
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400 opacity-60" />
          {/* Bottom Left */}
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400 opacity-60" />
          {/* Bottom Right */}
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400 opacity-60" />
        </div>

      </div>
    </div>
  );
};

