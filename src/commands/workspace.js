#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { findUp } from 'find-up';
import yaml from 'yaml';

const workspaceCommand = new Command('workspace')
  .description('Manage workspaces in your turborepo')
  .version('1.0.0');

const detectPackageManager = async () => {
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
};

const validatePackageName = (name) => {
  if (!name.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/)) {
    throw new Error('Invalid package name. Package names must be lowercase and can only contain alphanumeric characters, hyphens, and underscores.');
  }
  return true;
};

const getRootPackageJson = () => {
  try {
    const rootPath = process.cwd();
    const packageJsonPath = path.join(rootPath, 'package.json');
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    console.error(chalk.red('Error: Unable to find or parse root package.json'));
    process.exit(1);
  }
};

const updateWorkspaceConfig = async (packageManager, newPackagePath) => {
  const rootPath = process.cwd();
  
  // Update package.json workspaces
  const packageJsonPath = path.join(rootPath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (!packageJson.workspaces) {
    packageJson.workspaces = ['packages/*', 'apps/*'];
  }
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Update pnpm-workspace.yaml if using pnpm
  if (packageManager === 'pnpm') {
    const pnpmWorkspacePath = path.join(rootPath, 'pnpm-workspace.yaml');
    let pnpmWorkspace = { packages: ['packages/*', 'apps/*'] };
    
    if (fs.existsSync(pnpmWorkspacePath)) {
      const yaml = require('yaml');
      pnpmWorkspace = yaml.parse(fs.readFileSync(pnpmWorkspacePath, 'utf8'));
      if (!pnpmWorkspace.packages.includes('packages/*')) {
        pnpmWorkspace.packages.push('packages/*');
      }
      if (!pnpmWorkspace.packages.includes('apps/*')) {
        pnpmWorkspace.packages.push('apps/*');
      }
    }
    
    fs.writeFileSync(pnpmWorkspacePath, yaml.stringify(pnpmWorkspace));
  }
};

const promptPackageDetails = async (name = '', type = 'package') => {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Package name:',
      default: name,
      validate: (input) => {
        try {
          validatePackageName(input);
          return true;
        } catch (error) {
          return error.message;
        }
      }
    },
    {
      type: 'list',
      name: 'type',
      message: 'Package type:',
      choices: ['package', 'app'],
      default: type
    },
    {
      type: 'input',
      name: 'description',
      message: 'Package description:'
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author:'
    },
    {
      type: 'input',
      name: 'version',
      message: 'Version:',
      default: '0.0.1'
    },
    {
      type: 'confirm',
      name: 'private',
      message: 'Is this package private?',
      default: true
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select features to include:',
      choices: [
        { name: 'TypeScript', value: 'typescript' },
        { name: 'ESLint', value: 'eslint' },
        { name: 'Jest', value: 'jest' },
        { name: 'Prettier', value: 'prettier' }
      ]
    }
  ];

  return inquirer.prompt(questions);
};

const createPackage = async (name, type = 'package') => {
  const packageManager = await detectPackageManager();
  const details = await promptPackageDetails(name, type);
  
  const baseDir = details.type === 'app' ? 'apps' : 'packages';
  const packagePath = path.join(process.cwd(), baseDir, details.name);
  
  if (fs.existsSync(packagePath)) {
    console.error(chalk.red(`Error: ${details.type} "${details.name}" already exists`));
    process.exit(1);
  }

  // Create directory structure
  fs.mkdirSync(packagePath, { recursive: true });
  fs.mkdirSync(path.join(packagePath, 'src'), { recursive: true });

  // Create package.json
  const packageJson = {
    name: details.name,
    version: details.version,
    description: details.description,
    author: details.author,
    private: details.private,
    main: details.features.includes('typescript') ? './dist/index.js' : './src/index.js',
    types: details.features.includes('typescript') ? './dist/index.d.ts' : undefined,
    scripts: {
      build: details.features.includes('typescript') ? 'tsc' : 'echo "Add build script"',
      dev: 'echo "Add dev script"',
      lint: details.features.includes('eslint') ? 'eslint .' : 'echo "Add lint script"',
      test: details.features.includes('jest') ? 'jest' : 'echo "Add test script"',
      format: details.features.includes('prettier') ? 'prettier --write .' : 'echo "Add format script"'
    }
  };

  if (details.features.includes('typescript')) {
    // Create tsconfig.json
    const tsConfig = {
      extends: "../../tsconfig.base.json",
      compilerOptions: {
        outDir: "./dist",
        rootDir: "./src"
      },
      include: ["src/**/*"]
    };
    fs.writeFileSync(
      path.join(packagePath, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
  }

  fs.writeFileSync(
    path.join(packagePath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create index file
  const indexContent = details.features.includes('typescript')
    ? '// Add your TypeScript code here\n'
    : '// Add your JavaScript code here\n';

  fs.writeFileSync(
    path.join(packagePath, 'src', `index.${details.features.includes('typescript') ? 'ts' : 'js'}`),
    indexContent
  );

  // Update workspace configuration
  await updateWorkspaceConfig(packageManager, packagePath);

  console.log(chalk.green(`\nSuccessfully created ${details.type} "${details.name}"`));
  console.log(chalk.blue('\nNext steps:'));
  console.log(`1. cd ${path.relative(process.cwd(), packagePath)}`);
  console.log(`2. ${packageManager} install`);
  if (details.features.length > 0) {
    console.log('3. Add the following dependencies based on selected features:');
    if (details.features.includes('typescript')) console.log('   - typescript @types/node');
    if (details.features.includes('eslint')) console.log('   - eslint');
    if (details.features.includes('jest')) console.log('   - jest @types/jest');
    if (details.features.includes('prettier')) console.log('   - prettier');
  }
};

const deletePackage = async (name) => {
  const packageManager = await detectPackageManager();
  const rootPackageJson = getRootPackageJson();
  const workspaces = rootPackageJson.workspaces || ['packages/*', 'apps/*'];
  
  let packagePath;
  for (const workspace of workspaces) {
    const baseDir = workspace.split('/')[0];
    const testPath = path.join(process.cwd(), baseDir, name);
    if (fs.existsSync(testPath)) {
      packagePath = testPath;
      break;
    }
  }

  if (!packagePath) {
    console.error(chalk.red(`Error: Package "${name}" not found`));
    process.exit(1);
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
    default: false
  }]);

  if (confirm) {
    fs.rmSync(packagePath, { recursive: true, force: true });
    console.log(chalk.green(`Successfully deleted package "${name}"`));
  }
};

const listPackages = async () => {
  const packageManager = await detectPackageManager();
  const rootPackageJson = getRootPackageJson();
  const workspaces = rootPackageJson.workspaces || ['packages/*', 'apps/*'];
  
  console.log(chalk.blue('\nWorkspace packages:'));
  console.log(chalk.gray(`Package manager: ${packageManager}`));
  
  workspaces.forEach(workspace => {
    const baseDir = workspace.split('/')[0];
    const basePath = path.join(process.cwd(), baseDir);
    
    if (fs.existsSync(basePath)) {
      const packages = fs.readdirSync(basePath)
        .filter(file => fs.statSync(path.join(basePath, file)).isDirectory());
      
      if (packages.length > 0) {
        console.log(chalk.yellow(`\n${baseDir}:`));
        packages.forEach(pkg => {
          const packageJsonPath = path.join(basePath, pkg, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            console.log(`  - ${pkg} ${chalk.gray(`v${packageJson.version}`)}`);
            if (packageJson.description) {
              console.log(`    ${chalk.gray(packageJson.description)}`);
            }
          } else {
            console.log(`  - ${pkg}`);
          }
        });
      }
    }
  });
};

const initWorkspace = async () => {
  const packageManager = await detectPackageManager();
  
  // Prompt for workspace details
  const { workspaceName, description, author } = await inquirer.prompt([
    {
      type: 'input',
      name: 'workspaceName',
      message: 'Workspace name:',
      validate: (input) => {
        try {
          validatePackageName(input);
          return true;
        } catch (error) {
          return error.message;
        }
      }
    },
    {
      type: 'input',
      name: 'description',
      message: 'Workspace description:'
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author:'
    }
  ]);

  // Create directory structure
  fs.mkdirSync('packages', { recursive: true });
  fs.mkdirSync('apps', { recursive: true });

  // Create root package.json
  const packageJson = {
    name: workspaceName,
    version: '0.0.1',
    private: true,
    description,
    author,
    workspaces: [
      'packages/*',
      'apps/*'
    ],
    scripts: {
      build: 'turbo run build',
      dev: 'turbo run dev',
      lint: 'turbo run lint',
      test: 'turbo run test'
    }
  };

  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

  // Create turbo.json
  const turboJson = {
    $schema: "https://turbo.build/schema.json",
    globalDependencies: ["**/.env.*local"],
    pipeline: {
      build: {
        dependsOn: ["^build"],
        outputs: ["dist/**"]
      },
      lint: {},
      dev: {
        cache: false,
        persistent: true
      },
      test: {}
    }
  };

  fs.writeFileSync('turbo.json', JSON.stringify(turboJson, null, 2));

  // Create pnpm-workspace.yaml if using pnpm
  if (packageManager === 'pnpm') {
    const pnpmWorkspace = {
      packages: ['packages/*', 'apps/*']
    };
    fs.writeFileSync('pnpm-workspace.yaml', yaml.stringify(pnpmWorkspace));
  }

  // Create .gitignore
  const gitignore = `
# dependencies
node_modules
.pnp
.pnp.js

# testing
coverage

# build
dist
build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# local env files
.env*.local

# turbo
.turbo
`;

  fs.writeFileSync('.gitignore', gitignore.trim());

  console.log(chalk.green('\nWorkspace initialized successfully!'));
  console.log(chalk.blue('\nNext steps:'));
  console.log(`1. ${packageManager} install`);
  console.log('2. Create your first package:');
  console.log(`   ${packageManager} kabob workspace create`);
};

workspaceCommand
  .command('init')
  .description('Initialize a new workspace')
  .action(initWorkspace);

workspaceCommand
  .command('create')
  .description('Create a new package or app')
  .argument('[name]', 'name of the package')
  .option('-t, --type <type>', 'type of package (app or package)', 'package')
  .action(async (name, options) => {
    await createPackage(name, options.type);
  });

workspaceCommand
  .command('delete')
  .description('Delete a package or app')
  .argument('<name>', 'name of the package to delete')
  .action(async (name) => {
    await deletePackage(name);
  });

workspaceCommand
  .command('list')
  .description('List all packages and apps')
  .action(listPackages);

export { workspaceCommand };
