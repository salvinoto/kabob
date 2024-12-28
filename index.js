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
import { packageCommand } from './src/commands/package.js';
import { addDependencies, removeDependencies } from './src/utils/package-json.js';

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
async function executeInWorkspace(workspace, command, packages, packageManager, isInternal = false) {
  // Get the package name from package.json
  const packageJson = JSON.parse(readFileSync(path.join(workspace, 'package.json'), 'utf8'));
  const packageName = packageJson.name;
  
  // Fallback to directory name if no package name found
  const workspaceName = packageName || path.basename(workspace);

  if (isInternal) {
    try {
      if (command === 'add') {
        addDependencies(workspace, packages, packageManager);
        console.log(chalk.green(`✓ Added internal dependencies to ${workspaceName}`));
      } else if (command === 'remove') {
        removeDependencies(workspace, packages);
        console.log(chalk.green(`✓ Removed internal dependencies from ${workspaceName}`));
      }
      return;
    } catch (error) {
      console.error(chalk.red(`✗ Failed to modify package.json in ${workspaceName}`));
      throw error;
    }
  }

  const commands = {
    npm: {
      add: packages => `npm install ${packages.join(' ')} --workspace=${packageName}`,
      remove: packages => `npm uninstall ${packages.join(' ')} --workspace=${packageName}`,
      install: () => `npm install --workspace=${packageName}`
    },
    yarn: {
      add: packages => `yarn workspace ${packageName} add ${packages.join(' ')}`,
      remove: packages => `yarn workspace ${packageName} remove ${packages.join(' ')}`,
      install: () => `yarn workspace ${packageName} install`
    },
    pnpm: {
      add: packages => `pnpm add ${packages.join(' ')} --filter ${packageName}`,
      remove: packages => `pnpm remove ${packages.join(' ')} --filter ${packageName}`,
      install: () => `pnpm install --filter ${packageName}`
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
      cwd: process.cwd(),
      stdio: 'inherit',
      killSignal: 'SIGTERM'
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

// Find internal packages in the workspace
async function findInternalPackages() {
  const workspaces = await findWorkspaces();
  const internalPackages = [];

  for (const workspace of workspaces) {
    try {
      const pkgJsonPath = path.join(workspace, 'package.json');
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      
      // Only include packages that are not private
      if (pkgJson.name && !pkgJson.private) {
        internalPackages.push({
          name: pkgJson.name,
          version: pkgJson.version || '0.0.0',
          path: workspace,
          description: pkgJson.description || ''
        });
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not read package.json in ${workspace}`));
    }
  }

  return internalPackages;
}

// Select internal packages interactively
async function selectInternalPackages() {
  const internalPackages = await findInternalPackages();
  
  if (internalPackages.length === 0) {
    throw new Error('No internal packages found in the workspace');
  }

  const { selectedPackages } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedPackages',
      message: 'Select internal packages to add:',
      choices: internalPackages.map(pkg => ({
        name: `${pkg.name}@${pkg.version} - ${pkg.description}`,
        value: `${pkg.name}@workspace:*`,
        checked: false
      })),
      pageSize: 20
    }
  ]);

  return selectedPackages;
}

program
  .name('kabob')
  .description('Smart monorepo package manager')
  .version('1.0.0-alpha.2');

// Add commands
program.addCommand(workspaceCommand);
program.addCommand(packageCommand);

program
  .command('add')
  .description('Add packages to workspaces')
  .argument('[packages...]', 'packages to add')
  .option('--internal', 'Add internal workspace packages')
  .action(async (packages, options) => {
    try {
      const packageManager = await detectPackageManager();
      const allWorkspaces = await findWorkspaces();

      console.log(chalk.blue(`Using package manager: ${packageManager}`));
      console.log(chalk.blue(`Found ${allWorkspaces.length} workspace(s)`));

      // If --internal flag is used or no packages specified, show internal package selection
      let packagesToAdd = packages || [];
      let internalMode = false;
      
      if (options.internal || !packages?.length) {
        const internalPkgs = await selectInternalPackages();
        packagesToAdd = internalPkgs;
        internalMode = true;
      }

      if (packagesToAdd.length === 0) {
        console.log(chalk.yellow('No packages selected for installation'));
        return;
      }

      // Let user select workspaces
      const selectedWorkspaces = await selectWorkspaces(allWorkspaces);

      for (const workspace of selectedWorkspaces) {
        await executeInWorkspace(workspace, 'add', packagesToAdd, packageManager, internalMode);
      }

      // Run install after modifying package.json files
      if (internalMode) {
        console.log(chalk.blue('\nRunning install to update dependencies...'));
        execSync(`${packageManager} install`, {
          stdio: 'inherit',
          cwd: process.cwd()
        });
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('remove')
  .description('Remove packages from workspaces')
  .argument('[packages...]', 'packages to remove')
  .option('--internal', 'Remove internal workspace packages')
  .action(async (packages, options) => {
    try {
      const packageManager = await detectPackageManager();
      const allWorkspaces = await findWorkspaces();

      // If --internal flag is used or no packages specified, show internal package selection
      let packagesToRemove = packages || [];
      let internalMode = false;
      
      if (options.internal || !packages?.length) {
        const internalPkgs = await selectInternalPackages();
        packagesToRemove = internalPkgs;
        internalMode = true;
      }

      if (packagesToRemove.length === 0) {
        console.log(chalk.yellow('No packages selected for removal'));
        return;
      }

      // Let user select workspaces
      const selectedWorkspaces = await selectWorkspaces(allWorkspaces);

      for (const workspace of selectedWorkspaces) {
        await executeInWorkspace(workspace, 'remove', packagesToRemove, packageManager, internalMode);
      }

      // Run install after modifying package.json files
      if (internalMode) {
        console.log(chalk.blue('\nRunning install to update dependencies...'));
        execSync(`${packageManager} install`, {
          stdio: 'inherit',
          cwd: process.cwd()
        });
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