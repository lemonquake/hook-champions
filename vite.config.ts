import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv, Plugin} from 'vite';

function telemetryPlugin(): Plugin {
  return {
    name: 'telemetry-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/telemetry' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const telemetryFile = path.resolve(__dirname, 'public', 'ai-telemetry.json');
              let current = [];
              if (fs.existsSync(telemetryFile)) {
                try { current = JSON.parse(fs.readFileSync(telemetryFile, 'utf-8')); } catch (e) {}
              }
              current.push(data);
              fs.writeFileSync(telemetryFile, JSON.stringify(current, null, 2));
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch(e) {
              res.statusCode = 400;
              res.end('Bad Request');
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/hook-champions/',
    plugins: [react(), tailwindcss(), telemetryPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
