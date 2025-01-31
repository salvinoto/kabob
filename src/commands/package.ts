#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import type { PackageDetails, PackageType, Workspace } from '../types/index.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = path.resolve(__dirname, '../../');

const packageCommand = new Command('package')
  .description('Manage packages in your turborepo');

const getRootPackageJson = (): PackageDetails => {
  try {
    const rootPath = process.cwd();
    const packageJsonPath = path.join(rootPath, 'package.json');
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    console.error(chalk.red('Error: Unable to find or parse root package.json'));
    process.exit(1);
  }
};

const findInternalPackages = async (): Promise<Workspace[]> => {
  const rootPackageJson = getRootPackageJson();
  let patterns: string[] = [];
  
  if (rootPackageJson.workspaces) {
    if (Array.isArray(rootPackageJson.workspaces)) {
      patterns = rootPackageJson.workspaces;
    } else {
      patterns = rootPackageJson.workspaces.packages || [];
    }
  } else {
    patterns = ['packages/*', 'apps/*'];
  }

  const internalPackages: Workspace[] = [];

  for (const workspace of patterns) {
    const baseDir = workspace.split('/')[0];
    const basePath = path.join(process.cwd(), baseDir);
    
    if (fs.existsSync(basePath)) {
      const packages = fs.readdirSync(basePath)
        .filter(file => fs.statSync(path.join(basePath, file)).isDirectory());
      
      for (const pkg of packages) {
        const packageJsonPath = path.join(basePath, pkg, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            internalPackages.push({
              path: path.dirname(packageJsonPath),
              packageJson
            });
          } catch (error) {
            console.warn(chalk.yellow(`Warning: Could not parse package.json at ${packageJsonPath}`));
          }
        }
      }
    }
  }

  return internalPackages;
};

const copyGeneratorTemplate = async (): Promise<void> => {
  try {
    const { prefix } = await inquirer.prompt([{
      type: 'input',
      name: 'prefix',
      message: 'What package prefix would you like to use? (e.g., @repo, @workspace):',
      default: '@repo',
      validate: (input: string) => {
        if (!input.startsWith('@')) {
          return 'Prefix must start with @';
        }
        if (!input.match(/^@[a-z0-9-~][a-z0-9-._~]*$/)) {
          return 'Invalid prefix. Must be lowercase and can only contain alphanumeric characters, hyphens, and underscores.';
        }
        return true;
      }
    }]);

    const targetDir = path.join(process.cwd(), 'turbo/generators');
    const sourceDir = path.join(packageRoot, 'turbo/generators');

    // Create the target directory if it doesn't exist
    fs.mkdirSync(targetDir, { recursive: true });

    // Copy the generator files
    fs.cpSync(sourceDir, targetDir, { recursive: true });

    // Replace the prefix in all template files
    const templateFiles = ['config.ts', ...fs.readdirSync(path.join(targetDir, 'templates'))];
    for (const file of templateFiles) {
      const filePath = file === 'config.ts' 
        ? path.join(targetDir, file)
        : path.join(targetDir, 'templates', file);
      
      if (fs.statSync(filePath).isFile()) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/@workspace/g, prefix);
        fs.writeFileSync(filePath, content);
      }
    }

    console.log(chalk.green(`✓ Added package generator template to your project with prefix ${chalk.cyan(prefix)}`));
    console.log(chalk.blue('\nNext steps:'));
    console.log('  1. Create a new package by running in the root of your project:');
    console.log(chalk.cyan('     npx turbo gen run'));
    console.log('  2. Follow the prompts to configure your package');
  } catch (error) {
    console.error(chalk.red('Error copying generator template:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

const deletePackage = async (name: string): Promise<void> => {
  try {
    const workspaces = await findInternalPackages();
    const workspace = workspaces.find(w => w.packageJson.name === name);

    if (!workspace) {
      throw new Error(`Package not found: ${name}`);
    }

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete ${name}? This cannot be undone.`,
      default: false
    }]);

    if (!confirm) {
      console.log(chalk.yellow('Operation cancelled'));
      return;
    }

    fs.rmSync(workspace.path, { recursive: true, force: true });
    console.log(chalk.green(`✓ Deleted package: ${name}`));
  } catch (error) {
    console.error(chalk.red('Error deleting package:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

const listPackages = async (): Promise<void> => {
  try {
    const workspaces = await findInternalPackages();
    console.log(chalk.blue('\nAvailable packages:'));
    
    const packages = workspaces.reduce((acc, ws) => {
      const type = ws.path.includes('/apps/') ? 'app' : 'package';
      if (!acc[type]) acc[type] = [];
      acc[type].push(ws);
      return acc;
    }, {} as Record<string, Workspace[]>);

    if (packages.app?.length) {
      console.log(chalk.yellow('\nApps:'));
      packages.app.forEach(pkg => {
        console.log(`  ${chalk.green(pkg.packageJson.name)} ${chalk.gray(`(${path.relative(process.cwd(), pkg.path)})`)}`);
        if (pkg.packageJson.description) {
          console.log(`    ${chalk.dim(pkg.packageJson.description)}`);
        }
      });
    }

    if (packages.package?.length) {
      console.log(chalk.yellow('\nPackages:'));
      packages.package.forEach(pkg => {
        console.log(`  ${chalk.green(pkg.packageJson.name)} ${chalk.gray(`(${path.relative(process.cwd(), pkg.path)})`)}`);
        if (pkg.packageJson.description) {
          console.log(`    ${chalk.dim(pkg.packageJson.description)}`);
        }
      });
    }
  } catch (error) {
    console.error(chalk.red('Error listing packages:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

// Export functions
// Export functions
export { packageCommand, deletePackage, listPackages, findInternalPackages };

packageCommand
  .command('template')
  .description('Add the package generator template to your project')
  .action(copyGeneratorTemplate);

packageCommand
  .command('delete <name>')
  .description('Delete a package')
  .action(deletePackage);

packageCommand
  .command('list')
  .description('List all packages')
  .action(listPackages);
