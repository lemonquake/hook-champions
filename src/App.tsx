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

  const themeColors = {
    Cyber: '#050505',
    Jungle: '#061a06',
    Snow: '#cbd5e1',
    City: '#020617'
  };

  const bgColor = themeColors[theme] || '#050505';

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative">
      {gameState === 'menu' && <MainMenu />}
      {gameState === 'playing' && <UI />}
      
      {gameState === 'playing' && (
        <KeyboardControls map={keyboardMap}>
          <Canvas shadows camera={{ fov: 75 }}>
            <color attach="background" args={[bgColor]} />
            <fog attach="fog" args={[bgColor, 10, 60]} />
            
            <ambientLight intensity={0.2} />
            <directionalLight 
              castShadow 
              position={[20, 30, 10]} 
              intensity={1.5} 
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-30}
              shadow-camera-right={30}
              shadow-camera-top={30}
              shadow-camera-bottom={-30}
            />

            <Suspense fallback={null}>
              <Environment preset="city" />
              <Physics gravity={[0, -20, 0]}>
                <Arena />
                <Enemies />
                <Peers />
                <Player />
                <Effects />
              </Physics>
            </Suspense>

            <EffectComposer>
              <Bloom 
                luminanceThreshold={1.0} 
                mipmapBlur 
                intensity={1.0} 
              />
              <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
          </Canvas>
        </KeyboardControls>
      )}
    </div>
  );
}
