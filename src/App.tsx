import React, { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { KeyboardControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, GodRays } from '@react-three/postprocessing';
import { BlendFunction, Resizer, KernelSize } from 'postprocessing';

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

  const sunRef = useRef<any>(null);

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
          <Canvas shadows camera={{ fov: 75 }}>
            <color attach="background" args={[bgColor]} />
            <fog attach="fog" args={[bgColor, 10, 60]} />
            
            <ambientLight intensity={0.2} />
            <directionalLight 
              castShadow 
              position={[20, 30, 20]} 
              intensity={1.5} 
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-40}
              shadow-camera-right={40}
              shadow-camera-top={40}
              shadow-camera-bottom={-40}
            />

            <mesh ref={sunRef} position={theme === 'Orbital' ? [0, -100, 0] : [200, 300, 200]}>
              <sphereGeometry args={[10, 32, 32]} />
              <meshBasicMaterial color={theme === 'Volcano' ? '#ff4400' : theme === 'Orbital' ? '#00ffff' : '#ffffff'} transparent opacity={0} depthWrite={false} />
            </mesh>

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
              <GodRays
                sun={sunRef}
                blendFunction={BlendFunction.Screen}
                samples={40}
                density={0.96}
                decay={0.9}
                weight={0.4}
                exposure={0.5}
                clampMax={1}
                width={Resizer.AUTO_SIZE}
                height={Resizer.AUTO_SIZE}
                kernelSize={KernelSize.SMALL}
                blur={true}
              />
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
