#!/usr/bin/env node

import { Command } from 'commander';
import { glob } from 'glob';
import chalk from 'chalk';
import { findUp } from 'find-up';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import path from 'path';
import inquirer from 'inquirer';
import { detect } from 'package-manager-detector/detect';
import { resolveCommand } from 'package-manager-detector/commands';
import type { Command as PMCommand, ResolvedCommand } from 'package-manager-detector';
import { workspaceCommand } from './commands/workspace.js';
import { packageCommand } from './commands/package.js';
import { addDependencies, removeDependencies } from './utils/package-json.js';
import type { Workspace } from './types/index.js';
import { spawnSync } from 'child_process';
import fs from 'fs';

interface InternalPackage {
  name: string;
  version: string;
  path: string;
  description: string;
}

const program = new Command();

// Handle exit signals
function handleExit(signal: string): void {
  console.log(chalk.yellow(`\n${signal} received. Exiting gracefully...`));
  process.exit(0);
}

// Set up signal handlers
process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error(chalk.red('\nUnhandled Promise Rejection:'), reason);
  process.exit(1);
});

// Find all workspace package.json files
async function findWorkspaces(): Promise<string[]> {
  const rootPkgPath = await findUp('package.json');
  if (!rootPkgPath) {
    throw new Error('No package.json found in the current directory or its parents');
  }

  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  const rootDir = path.dirname(rootPkgPath);

  let workspacePatterns: string[] = [];

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
    return [rootDir];
  }

  const allWorkspacePaths: string[] = [];
  for (const pattern of workspacePatterns) {
    const packageJsonPattern = pattern.endsWith('package.json')
      ? pattern
      : path.join(pattern, 'package.json');

    const matches = await glob(packageJsonPattern, {
      cwd: rootDir,
      absolute: true,
      ignore: ['**/node_modules/**']
    });

    allWorkspacePaths.push(...matches.map(match => path.dirname(match)));
  }

  return allWorkspacePaths;
}

// Find internal packages in the workspace
async function findInternalPackages(): Promise<InternalPackage[]> {
  const workspaces = await findWorkspaces();
  const internalPackages: InternalPackage[] = [];

  for (const workspace of workspaces) {
    try {
      const packageJsonPath = path.join(workspace, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      internalPackages.push({
        name: packageJson.name,
        version: packageJson.version,
        path: workspace,
        description: packageJson.description || ''
      });
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not read package.json at ${workspace}`));
    }
  }

  return internalPackages;
}

// Validate workspace selection
async function validate(answer: string[]): Promise<true | string> {
  if (answer.length === 0) {
    return 'Please select at least one workspace';
  }
  return true;
}

// Add dependencies to workspaces
async function addToWorkspaces(
  packages: string[],
  options: { workspace?: string; internal?: boolean; dev?: boolean }
): Promise<void> {
  try {
    const pm = await detect();
    if (!pm) {
      throw new Error('Could not detect package manager');
    }

    let selectedWorkspaces: string[] = [];

    if (options.workspace) {
      // Single workspace mode
      const workspace = path.resolve(options.workspace);
      if (!fs.existsSync(path.join(workspace, 'package.json'))) {
        throw new Error(`Invalid workspace path: ${options.workspace}`);
      }
      selectedWorkspaces = [workspace];
    } else {
      // Interactive workspace selection
      const workspaces = await findWorkspaces();
      const choices = workspaces.map(workspace => {
        const packageJson = JSON.parse(readFileSync(path.join(workspace, 'package.json'), 'utf8'));
        return {
          name: `${packageJson.name} (${path.relative(process.cwd(), workspace)})`,
          value: workspace
        };
      });

      const { workspaces: selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'workspaces',
          message: 'Select workspaces to add dependencies to:',
          choices,
          validate
        }
      ]);

      selectedWorkspaces = selected;
    }

    // If --internal flag is set, resolve internal package names
    if (options.internal) {
      const internalPackages = await findInternalPackages();
      const internalNames = internalPackages.map(pkg => pkg.name);
      packages = packages.map(pkg => {
        const match = internalNames.find(name => name === pkg || name.endsWith(`/${pkg}`));
        if (!match) {
          throw new Error(`Internal package not found: ${pkg}`);
        }
        return match;
      });
    }

    // Add dependencies to each selected workspace
    for (const workspace of selectedWorkspaces) {
      const command = resolveCommand(
        pm.name,
        'add',
        [...packages, ...(options.dev ? ['--dev'] : [])]
      );

      if (!command) {
        throw new Error(`Could not resolve add command for ${pm.name}`);
      }

      console.log(chalk.blue(`\nAdding dependencies to ${path.relative(process.cwd(), workspace)}...`));
      const result = spawnSync(command.command, command.args, {
        cwd: workspace,
        stdio: 'inherit',
        shell: true
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        throw new Error(`Failed to add dependencies to ${workspace}`);
      }
    }

    console.log(chalk.green('\nDependencies added successfully!'));
  } catch (error) {
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Remove dependencies from workspaces
async function removeFromWorkspaces(
  packages: string[],
  options: { workspace?: string; internal?: boolean }
): Promise<void> {
  try {
    const pm = await detect();
    if (!pm) {
      throw new Error('Could not detect package manager');
    }

    let selectedWorkspaces: string[] = [];

    if (options.workspace) {
      // Single workspace mode
      const workspace = path.resolve(options.workspace);
      if (!fs.existsSync(path.join(workspace, 'package.json'))) {
        throw new Error(`Invalid workspace path: ${options.workspace}`);
      }
      selectedWorkspaces = [workspace];
    } else {
      // Interactive workspace selection
      const workspaces = await findWorkspaces();
      const choices = workspaces.map(workspace => {
        const packageJson = JSON.parse(readFileSync(path.join(workspace, 'package.json'), 'utf8'));
        return {
          name: `${packageJson.name} (${path.relative(process.cwd(), workspace)})`,
          value: workspace
        };
      });

      const { workspaces: selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'workspaces',
          message: 'Select workspaces to remove dependencies from:',
          choices,
          validate
        }
      ]);

      selectedWorkspaces = selected;
    }

    // If --internal flag is set, resolve internal package names
    if (options.internal) {
      const internalPackages = await findInternalPackages();
      const internalNames = internalPackages.map(pkg => pkg.name);
      packages = packages.map(pkg => {
        const match = internalNames.find(name => name === pkg || name.endsWith(`/${pkg}`));
        if (!match) {
          throw new Error(`Internal package not found: ${pkg}`);
        }
        return match;
      });
    }

    // Remove dependencies from each selected workspace
    for (const workspace of selectedWorkspaces) {
      const command = resolveCommand(pm.name, 'uninstall', packages);

      if (!command) {
        throw new Error(`Could not resolve remove command for ${pm.name}`);
      }

      console.log(chalk.blue(`\nRemoving dependencies from ${path.relative(process.cwd(), workspace)}...`));
      const result = spawnSync(command.command, command.args, {
        cwd: workspace,
        stdio: 'inherit',
        shell: true
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        throw new Error(`Failed to remove dependencies from ${workspace}`);
      }
    }

    console.log(chalk.green('\nDependencies removed successfully!'));
  } catch (error) {
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Register commands
program
  .name('kabob')
  .description('A CLI tool for managing Turborepo workspaces')
  .version('1.0.0');

program.addCommand(workspaceCommand);
program.addCommand(packageCommand);

program
  .command('add <packages...>')
  .description('Add dependencies to workspaces')
  .option('-w, --workspace <workspace>', 'Target specific workspace')
  .option('--internal', 'Add internal workspace packages')
  .option('-D, --dev', 'Add as development dependency')
  .action((packages, options) => addToWorkspaces(packages, options));

program
  .command('remove <packages...>')
  .description('Remove dependencies from workspaces')
  .option('-w, --workspace <workspace>', 'Target specific workspace')
  .option('--internal', 'Remove internal workspace packages')
  .action((packages, options) => removeFromWorkspaces(packages, options));

program.parse();
