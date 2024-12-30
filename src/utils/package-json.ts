import fs from 'fs';
import path from 'path';
import { detect } from 'package-manager-detector/detect';
import { resolveCommand } from 'package-manager-detector/commands';
import { spawnSync } from 'child_process';
import chalk from 'chalk';

export async function addDependencies(
  packagePath: string,
  dependencies: string[],
  isDev = false
): Promise<void> {
  const packageJsonPath = path.join(packagePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at ${packagePath}`);
  }

  const pm = await detect();
  if (!pm) {
    throw new Error('Could not detect package manager');
  }

  const command = resolveCommand(
    pm.name,
    'add',
    [...dependencies, ...(isDev ? ['--dev'] : [])]
  );

  if (!command) {
    throw new Error(`Could not resolve add command for ${pm.name}`);
  }

  console.log(chalk.blue(`Installing dependencies using ${pm.name}...`));
  const result = spawnSync(command.command, command.args, {
    cwd: packagePath,
    stdio: 'inherit',
    shell: true
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Failed to install dependencies with ${pm.name}`);
  }

  console.log(chalk.green('Dependencies installed successfully!'));
}

export async function removeDependencies(
  packagePath: string,
  dependencies: string[]
): Promise<void> {
  const packageJsonPath = path.join(packagePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at ${packagePath}`);
  }

  const pm = await detect();
  if (!pm) {
    throw new Error('Could not detect package manager');
  }

  const command = resolveCommand(pm.name, 'uninstall', dependencies);
  if (!command) {
    throw new Error(`Could not resolve uninstall command for ${pm.name}`);
  }

  console.log(chalk.blue(`Removing dependencies using ${pm.name}...`));
  const result = spawnSync(command.command, command.args, {
    cwd: packagePath,
    stdio: 'inherit',
    shell: true
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Failed to remove dependencies with ${pm.name}`);
  }

  console.log(chalk.green('Dependencies removed successfully!'));
}

export async function installDependencies(
  packagePath: string,
  options: { clean?: boolean; frozen?: boolean } = {}
): Promise<void> {
  const packageJsonPath = path.join(packagePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at ${packagePath}`);
  }

  const pm = await detect();
  if (!pm) {
    throw new Error('Could not detect package manager');
  }

  // Get the base install command
  const command = resolveCommand(pm.name, 'install', []);
  if (!command) {
    throw new Error(`Could not resolve install command for ${pm.name}`);
  }

  // Add additional flags based on options
  const args = [...command.args];
  if (options.clean) {
    if (pm.name === 'npm') {
      args.push('--clean-install');
    } else if (pm.name === 'pnpm') {
      args.push('--force');
    } else if (pm.name === 'yarn') {
      args.push('--clean');
    }
  }

  if (options.frozen) {
    if (pm.name === 'npm') {
      args.push('--frozen-lockfile');
    } else if (pm.name === 'pnpm') {
      args.push('--frozen-lockfile');
    } else if (pm.name === 'yarn') {
      args.push('--frozen-lockfile');
    }
  }

  console.log(chalk.blue(`Installing dependencies using ${pm.name}...`));
  const result = spawnSync(command.command, args, {
    cwd: packagePath,
    stdio: 'inherit',
    shell: true
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Failed to install dependencies with ${pm.name}`);
  }

  console.log(chalk.green('Dependencies installed successfully!'));
}
