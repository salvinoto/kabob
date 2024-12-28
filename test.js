import { addDependencies } from './src/utils/package-json.js';
import fs from 'fs';
import path from 'path';

// Create a temporary package.json
const testDir = './test-workspace';
fs.mkdirSync(testDir, { recursive: true });
fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
  name: "test-workspace",
  version: "1.0.0"
}, null, 2));

// Test with pnpm
console.log('Testing pnpm:');
addDependencies(testDir, ['@workspace/typescript-config@workspace:'], 'pnpm');
console.log(JSON.parse(fs.readFileSync(path.join(testDir, 'package.json'), 'utf8')));

// Clean up
fs.rmSync(testDir, { recursive: true, force: true });
