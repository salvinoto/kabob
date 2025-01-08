#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { findUp } from 'find-up';
import yaml from 'yaml';
import { detect } from 'package-manager-detector/detect';
import { resolveCommand } from 'package-manager-detector/commands';
import type { Command as PMCommand, DetectResult, ResolvedCommand } from 'package-manager-detector';
import { glob } from 'glob';
import type { PackageDetails, PackageType, Workspace } from '../types/index.js';
import { getTemplate, listTemplates } from '../templates/package-templates.js';

interface PackageAnswers extends PackageDetails {
  type: PackageType;
  useScope: boolean;
  scope?: string;
  packageName: string;
  author?: string;
  private: boolean;
  features: string[];
  template: string;
}

interface ScopeAnswers {
  useScope: boolean;
  scope?: string;
}

const packageCommand = new Command('package')
  .description('Manage packages in your turborepo');

const validatePackageName = (name: string, type: PackageType = 'package'): boolean => {
  if (!name.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/)) {
    throw new Error('Invalid package name. Names must be lowercase and can only contain alphanumeric characters, hyphens, and underscores.');
  }

  if (type === 'package') {
    if (name.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?ui$/)) {
      console.log(chalk.yellow('Tip: Consider being more specific for UI packages, e.g., "@repo/ui-core", "@repo/ui-components"'));
    }
    if (name.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?configs?$/)) {
      console.log(chalk.yellow('Tip: Consider being more specific for config packages, e.g., "@repo/eslint-config", "@repo/tsconfig"'));
    }
  }

  if (type === 'app') {
    if (name.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?(web|app|client)$/)) {
      console.log(chalk.yellow('Tip: Consider using a more descriptive name for your app, e.g., "admin", "dashboard", "docs"'));
    }
  }

  return true;
};

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

const promptPackageDetails = async (name = '', type: PackageType = 'package'): Promise<PackageAnswers> => {
  const rootPackageJson = getRootPackageJson();
  const workspaceScope = rootPackageJson.name ? rootPackageJson.name.split('/')[0] : '';

  // If name is provided with a scope, split it
  let defaultName = name;
  let initialScope = '';
  if (name && name.includes('/')) {
    [initialScope, defaultName] = name.split('/');
    initialScope = initialScope.replace('@', '');
  }

  // First get the type and template
  const templates = listTemplates();
  const { type: selectedType, template: selectedTemplate } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Package type:',
      choices: [
        { 
          name: 'Package (shared library, component, or utility)',
          value: 'package' as const
        },
        { 
          name: 'App (web app, API, or service)',
          value: 'app' as const
        }
      ],
      default: type
    },
    {
      type: 'list',
      name: 'template',
      message: 'Select a template:',
      choices: templates.map(t => ({
        name: t.name,
        value: t.name.match(/\((.*?)\)/)?.[1] || '',
        description: t.description
      }))
    }
  ]);

  // Then get scope information
  const scopeAnswers: ScopeAnswers = (!name || !name.includes('@')) ? await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useScope',
      message: 'Use package scope?',
      default: !!initialScope || !!workspaceScope
    },
    {
      type: 'input',
      name: 'scope',
      message: 'Package scope (without @):',
      default: initialScope || workspaceScope.replace('@', ''),
      when: (answers: { useScope: boolean }) => answers.useScope,
      validate: (scope: string) => {
        if (!scope.match(/^[a-z0-9-~][a-z0-9-._~]*$/)) {
          return 'Invalid scope. Scopes must be lowercase and can only contain alphanumeric characters, hyphens, and underscores.';
        }
        return true;
      }
    }
  ]) : { useScope: true, scope: initialScope };

  // Then get the rest of the details
  const otherAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'packageName',
      message: scopeAnswers.useScope ? 'Package name (without scope):' : 'Package name:',
      default: defaultName,
      validate: (input: string) => {
        const fullName = scopeAnswers.useScope ? `@${scopeAnswers.scope}/${input}` : input;
        try {
          return validatePackageName(fullName, selectedType);
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }
    },
    {
      type: 'input',
      name: 'description',
      message: 'Package description:',
      validate: (input: string) => {
        if (input.length < 3) {
          return 'Please provide a meaningful description (at least 3 characters)';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: rootPackageJson.author || ''
    },
    {
      type: 'input',
      name: 'version',
      message: 'Version:',
      default: '0.0.1',
      validate: (input: string) => {
        if (!input.match(/^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/)) {
          return 'Invalid version. Please use semantic versioning (e.g., 1.0.0, 0.1.0-beta.1)';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'private',
      message: (answers: PackageAnswers) => `Is this ${selectedType} private?`,
      default: selectedType === 'app'
    }
  ]);

  // Combine all answers and add standard features
  const packageDetails: PackageAnswers = {
    name: scopeAnswers.useScope && scopeAnswers.scope ? `@${scopeAnswers.scope}/${otherAnswers.packageName}` : otherAnswers.packageName,
    description: otherAnswers.description,
    version: otherAnswers.version,
    author: otherAnswers.author,
    private: otherAnswers.private,
    features: ['typescript', 'eslint'],
    dependencies: {},
    devDependencies: {},
    scripts: {
      build: 'tsc',
      test: 'jest',
      lint: 'eslint .'
    },
    type: selectedType,
    useScope: scopeAnswers.useScope,
    scope: scopeAnswers.scope,
    packageName: otherAnswers.packageName,
    template: selectedTemplate
  };

  return packageDetails;
};

const detectPackageManager = async (): Promise<DetectResult> => {
  const pm = await detect();
  if (!pm) {
    throw new Error('Could not detect package manager');
  }
  return pm;
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

const createPackage = async (name: string, type: PackageType = 'package'): Promise<void> => {
  try {
    const details = await promptPackageDetails(name, type);
    const pm = await detectPackageManager();
    const template = getTemplate(details.template);

    const addCommand = resolveCommand(pm.name, 'add', [details.name]);
    if (!addCommand) {
      throw new Error(`Could not resolve add command for ${pm.name}`);
    }

    // Create package directory
    const baseDir = type === 'app' ? 'apps' : 'packages';
    const packageName = details.packageName || details.name.split('/').pop() || '';
    const packageDir = path.join(process.cwd(), baseDir, packageName);

    if (fs.existsSync(packageDir)) {
      throw new Error(`Directory already exists: ${packageDir}`);
    }

    // Create directory structure
    fs.mkdirSync(packageDir, { recursive: true });
    fs.mkdirSync(path.join(packageDir, 'src'));

    // Create package.json
    const packageJson = {
      name: details.name,
      version: details.version,
      description: details.description,
      author: details.author,
      private: details.private,
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      ...template.packageJson,
      dependencies: {
        ...(template.dependencies || []).reduce((acc, dep) => ({ ...acc, [dep]: '*' }), {}),
        ...details.dependencies
      },
      devDependencies: {
        ...(template.devDependencies || []).reduce((acc, dep) => ({ ...acc, [dep]: '*' }), {}),
        ...details.devDependencies
      }
    };

    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create tsconfig.json
    fs.writeFileSync(
      path.join(packageDir, 'tsconfig.json'),
      JSON.stringify(template.tsconfig, null, 2)
    );

    // Create template-specific files
    if (template.files) {
      for (const [filePath, content] of Object.entries(template.files)) {
        const fullPath = path.join(packageDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content.trim());
      }
    }

    // Create README.md
    const readme = `# ${details.name}

${details.description}

## Installation

\`\`\`bash
${addCommand.command} ${addCommand.args.join(' ')}
\`\`\`

## Usage

See source files for usage examples.
`;
    fs.writeFileSync(path.join(packageDir, 'README.md'), readme);

    console.log(chalk.green(`✓ Created ${type} at ${packageDir} using ${template.name} template`));
    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. cd ${path.relative(process.cwd(), packageDir)}`);
    console.log(`  2. ${addCommand.command} ${addCommand.args.join(' ')}`);
    console.log('  3. Install dependencies');
    console.log('  4. Write your code in src/');
    console.log('  5. Run tests with npm test');
  } catch (error) {
    console.error(chalk.red('Error creating package:'), error instanceof Error ? error.message : String(error));
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
export { packageCommand, createPackage, deletePackage, listPackages };

packageCommand
  .command('create [name]')
  .description('Create a new package')
  .option('-t, --type <type>', 'Package type (package or app)', 'package')
  .action(async (name: string, options: { type: PackageType }) => {
    await createPackage(name, options.type);
  });

packageCommand
  .command('delete <name>')
  .description('Delete a package')
  .action(deletePackage);

packageCommand
  .command('list')
  .description('List all packages')
  .action(listPackages);
