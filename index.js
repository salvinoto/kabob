#!/usr/bin/env node

import { Command } from 'commander';
import { glob } from 'glob';
import chalk from 'chalk';
import { findUp } from 'find-up';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { execSync } from 'child_process';
import path from 'path';
import inquirer from 'inquirer';
import { workspaceCommand } from './src/commands/workspace.js';

const program = new Command();

// Handle exit signals
function handleExit(signal) {
  console.log(chalk.yellow(`\n${signal} received. Exiting gracefully...`));
  process.exit(0);
}

// Set up signal handlers
process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('\nUnhandled Promise Rejection:'), reason);
  process.exit(1);
});

// Detect package manager by looking for lock files
async function detectPackageManager() {
  const lockFiles = {
    'yarn.lock': 'yarn',
    'package-lock.json': 'npm',
    'pnpm-lock.yaml': 'pnpm'
  };

  for (const [file, manager] of Object.entries(lockFiles)) {
    const found = await findUp(file);
    if (found) {
      return manager;
    }
  }
  return 'npm'; // Default to npm if no lock file found
}

// Find all workspace package.json files
async function findWorkspaces() {
  const rootPkgPath = await findUp('package.json');
  if (!rootPkgPath) {
    throw new Error('No package.json found in the current directory or its parents');
  }

  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  const rootDir = path.dirname(rootPkgPath);

  let workspacePatterns = [];

  // Handle different workspace configurations
  if (rootPkg.workspaces) {
    workspacePatterns = Array.isArray(rootPkg.workspaces)
      ? rootPkg.workspaces
      : rootPkg.workspaces.packages || [];
  }

  // Check for pnpm workspace config
  const pnpmWorkspacePath = path.join(rootDir, 'pnpm-workspace.yaml');
  try {
    const pnpmConfig = parseYaml(readFileSync(pnpmWorkspacePath, 'utf8'));
    if (pnpmConfig.packages) {
      workspacePatterns = pnpmConfig.packages;
    }
  } catch (e) {
    // Ignore if pnpm workspace file doesn't exist
  }

  if (workspacePatterns.length === 0) {
    return [rootDir]; // If no workspaces defined, just use root
  }

  // Process each pattern and combine results
  const allWorkspacePaths = [];
  for (const pattern of workspacePatterns) {
    // Ensure pattern ends with package.json
    const packageJsonPattern = pattern.endsWith('package.json')
      ? pattern
      : path.join(pattern, 'package.json');

    // Find all package.json files matching the pattern
    const matches = await glob(packageJsonPattern, {
      cwd: rootDir,
      absolute: true,
      ignore: ['**/node_modules/**']
    });

    // Add directory paths to results
    allWorkspacePaths.push(...matches.map(match => path.dirname(match)));
  }

  // Remove duplicates and sort
  return [...new Set(allWorkspacePaths)].sort();
}

// Execute package manager command in each workspace
function executeInWorkspace(workspace, command, packages, packageManager) {
  // Get the workspace name from the path
  const workspaceName = path.basename(workspace);

  const commands = {
    npm: {
      add: packages => `npm install ${packages.join(' ')} --workspace=${workspaceName}`,
      remove: packages => `npm uninstall ${packages.join(' ')} --workspace=${workspaceName}`,
      install: () => `npm install --workspace=${workspaceName}`
    },
    yarn: {
      add: packages => `yarn workspace ${workspaceName} add ${packages.join(' ')}`,
      remove: packages => `yarn workspace ${workspaceName} remove ${packages.join(' ')}`,
      install: () => `yarn workspace ${workspaceName} install`
    },
    pnpm: {
      add: packages => `pnpm add ${packages.join(' ')} --filter ${workspaceName}`,
      remove: packages => `pnpm remove ${packages.join(' ')} --filter ${workspaceName}`,
      install: () => `pnpm install --filter ${workspaceName}`
    }
  };

  const commandGenerator = commands[packageManager][command];
  if (!commandGenerator) {
    throw new Error(`Unknown command: ${command}`);
  }

  const fullCommand = packages ? commandGenerator(packages) : commandGenerator();

  try {
    console.log(chalk.blue(`\nExecuting in ${workspaceName}:`), chalk.yellow(fullCommand));
    execSync(fullCommand, {
      cwd: process.cwd(), // Execute from root of monorepo
      stdio: 'inherit',
      killSignal: 'SIGTERM' // Ensure child processes can be terminated
    });
    console.log(chalk.green(`✓ Success in ${workspaceName}`));
  } catch (error) {
    if (error.signal === 'SIGTERM' || error.signal === 'SIGINT') {
      handleExit(error.signal);
    }
    console.error(chalk.red(`✗ Failed in ${workspaceName}`));
    throw error;
  }
}

// Select workspaces interactively
async function selectWorkspaces(workspaces) {
  try {
    const choices = workspaces.map(workspace => ({
      name: `${path.basename(workspace)} (${workspace})`,
      value: workspace,
      checked: true // Default all workspaces to selected
    }));

    const { selectedWorkspaces } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedWorkspaces',
        message: 'Select workspaces to apply the command to (Ctrl+C to exit):',
        choices,
        pageSize: 20,
        validate: answer => {
          if (answer.length < 1) {
            return 'You must choose at least one workspace.';
          }
          return true;
        }
      }
    ]);

    return selectedWorkspaces;
  } catch (error) {
    if (error.isTtyError) {
      console.error(chalk.red('\nPrompt couldn\'t be rendered in the current environment'));
    }
    throw error;
  }
}

program
  .name('kabob')
  .description('Smart monorepo package manager')
  .version('1.0.0-alpha.2');

// Add workspace command
program.addCommand(workspaceCommand);

program
  .command('add')
  .description('Add packages to workspaces')
  .argument('<packages...>', 'packages to add')
  .action(async (packages) => {
    try {
      const packageManager = await detectPackageManager();
      const allWorkspaces = await findWorkspaces();

      console.log(chalk.blue(`Using package manager: ${packageManager}`));
      console.log(chalk.blue(`Found ${allWorkspaces.length} workspace(s)`));

      // Let user select workspaces
      const selectedWorkspaces = await selectWorkspaces(allWorkspaces);

      for (const workspace of selectedWorkspaces) {
        await executeInWorkspace(workspace, 'add', packages, packageManager);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('remove')
  .description('Remove packages from workspaces')
  .argument('<packages...>', 'packages to remove')
  .action(async (packages) => {
    try {
      const packageManager = await detectPackageManager();
      const allWorkspaces = await findWorkspaces();

      // Let user select workspaces
      const selectedWorkspaces = await selectWorkspaces(allWorkspaces);

      for (const workspace of selectedWorkspaces) {
        await executeInWorkspace(workspace, 'remove', packages, packageManager);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Install all dependencies in workspaces')
  .action(async () => {
    try {
      const packageManager = await detectPackageManager();
      const allWorkspaces = await findWorkspaces();

      // Let user select workspaces
      const selectedWorkspaces = await selectWorkspaces(allWorkspaces);

      for (const workspace of selectedWorkspaces) {
        await executeInWorkspace(workspace, 'install', null, packageManager);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();