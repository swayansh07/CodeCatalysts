import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("Pterodactyl Bridge: Starting AI Study Planner via tsx...");

// This spawns the actual TypeScript server using the 'tsx' package
const child = spawn('npx', ['tsx', path.join(__dirname, 'server.ts')], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'production' }
});

child.on('exit', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
