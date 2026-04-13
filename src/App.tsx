import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { KeyboardControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

import { UI } from './components/UI';
import { MainMenu } from './components/MainMenu';
import { Arena } from './components/Arena';
import { Enemies } from './components/Enemies';
import { Player } from './components/Player';
import { Peers } from './components/Peers';
import { Effects } from './components/Effects';
import { useGameStore } from './store';

const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
  { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
  { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
  { name: 'jump', keys: ['Space', ' '] },
];

export default function App() {
  const gameState = useGameStore(state => state.gameState);
  const theme = useGameStore(state => state.mapConfig.theme);



  const themeColors: Record<string, string> = {
    'The Pit': '#1a0f0a',
    'Crossfire': '#050a1f',
    'Highrise': '#0f172a',
    'Fortress': '#061a14',
    'Orbital': '#180524',
    'Volcano': '#260707'
  };

  const bgColor = themeColors[theme] || '#050510';

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative">
      {gameState === 'menu' && <MainMenu />}
      {gameState === 'playing' && <UI />}
      
      {gameState === 'playing' && (
        <KeyboardControls map={keyboardMap}>
          <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 75 }}>
            <color attach="background" args={[bgColor]} />
            <fog attach="fog" args={[bgColor, 10, 60]} />
            <GameLoopManager />
            
            <ambientLight intensity={0.2} />
            <directionalLight 
              castShadow 
              position={[20, 30, 20]} 
              intensity={1.5} 
              shadow-mapSize={[1024, 1024]}
              shadow-camera-left={-40}
              shadow-camera-right={40}
              shadow-camera-top={40}
              shadow-camera-bottom={-40}
            />



            <Suspense fallback={null}>
              <Environment preset="city" />
              <Physics gravity={[0, -20, 0]} timeStep="vary">
                <Arena />
                <Enemies />
                <Peers />
                <Player />
                <Effects />
              </Physics>
            </Suspense>

            <EffectComposer multisampling={0} disableNormalPass>
              <Bloom 
                luminanceThreshold={1.0} 
                mipmapBlur={false} 
                intensity={1.0}
                resolutionScale={0.5}
              />
              <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
          </Canvas>
        </KeyboardControls>
      )}
    </div>
  );
}

// Ensure the core game mechanics only tick ONCE per frame globally
import { useFrame } from '@react-three/fiber';
const GameLoopManager = () => {
  useFrame((state, delta) => {
    // Only respawn tick once per frame
    useGameStore.getState().tickRespawn(delta);
  });
  return null;
};
