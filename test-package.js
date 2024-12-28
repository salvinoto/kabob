import { createPackage } from './src/commands/package.js';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';

// Mock inquirer
const originalPrompt = inquirer.prompt;
let currentTest = 1;

inquirer.prompt = (questions) => {
  const mockAnswers = {
    1: {
      type: 'package',
      useScope: true,
      scope: 'test',
      packageName: 'package-one',
      name: '@test/package-one',
      description: 'Test package one',
      author: 'Test Author',
      version: '0.0.1',
      private: true
    },
    2: {
      type: 'package',
      useScope: true,
      scope: 'test',
      packageName: 'package-two',
      name: '@test/package-two',
      description: 'Test package two',
      author: 'Test Author',
      version: '0.0.1',
      private: true
    }
  };

  const answers = {};
  questions.forEach(q => {
    if (q.name === 'type') answers.type = mockAnswers[currentTest].type;
    else if (q.name === 'useScope') answers.useScope = mockAnswers[currentTest].useScope;
    else if (q.name === 'scope') answers.scope = mockAnswers[currentTest].scope;
    else if (q.name === 'packageName') answers.packageName = mockAnswers[currentTest].packageName;
    else if (q.name === 'name') answers.name = mockAnswers[currentTest].name;
    else if (q.name === 'description') answers.description = mockAnswers[currentTest].description;
    else if (q.name === 'author') answers.author = mockAnswers[currentTest].author;
    else if (q.name === 'version') answers.version = mockAnswers[currentTest].version;
    else if (q.name === 'private') answers.private = mockAnswers[currentTest].private;
  });

  return Promise.resolve(answers);
};

// Create test workspace structure
const rootDir = process.cwd();
const testDir = path.join(rootDir, 'test-workspace');
fs.mkdirSync(testDir, { recursive: true });
fs.mkdirSync(path.join(testDir, 'packages'), { recursive: true });

// Create root package.json
fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
  name: "test-workspace",
  version: "1.0.0",
  workspaces: ["packages/*"]
}, null, 2));

// Create pnpm-lock.yaml to test pnpm behavior
fs.writeFileSync(path.join(testDir, 'pnpm-lock.yaml'), '');

try {
  process.chdir(testDir);

  // First test: Without typescript-config package
  console.log('\nTest 1: Creating package without shared typescript config');
  await createPackage();
  currentTest++;

  // Now create a typescript-config package
  console.log('\nCreating shared typescript config package');
  fs.mkdirSync(path.join(testDir, 'packages', 'typescript-config'), { recursive: true });
  fs.writeFileSync(
    path.join(testDir, 'packages', 'typescript-config', 'package.json'),
    JSON.stringify({
      name: "@test/typescript-config",
      version: "1.0.0"
    }, null, 2)
  );

  // Second test: With typescript-config package
  console.log('\nTest 2: Creating package with shared typescript config');
  await createPackage();

  // Print results
  console.log('\nResults for package-one (no shared config):');
  const packageOneFiles = {
    'package.json': JSON.parse(fs.readFileSync(path.join(testDir, 'packages', 'package-one', 'package.json'), 'utf8')),
    'tsconfig.json': JSON.parse(fs.readFileSync(path.join(testDir, 'packages', 'package-one', 'tsconfig.json'), 'utf8')),
    'tsconfig.base.json': JSON.parse(fs.readFileSync(path.join(testDir, 'packages', 'package-one', 'tsconfig.base.json'), 'utf8'))
  };
  console.log(JSON.stringify(packageOneFiles, null, 2));

  console.log('\nResults for package-two (with shared config):');
  const packageTwoFiles = {
    'package.json': JSON.parse(fs.readFileSync(path.join(testDir, 'packages', 'package-two', 'package.json'), 'utf8')),
    'tsconfig.json': JSON.parse(fs.readFileSync(path.join(testDir, 'packages', 'package-two', 'tsconfig.json'), 'utf8'))
  };
  console.log(JSON.stringify(packageTwoFiles, null, 2));
} finally {
  // Restore original inquirer prompt
  inquirer.prompt = originalPrompt;
  // Clean up
  process.chdir(rootDir);
  fs.rmSync(testDir, { recursive: true, force: true });
}
