#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { findUp } from 'find-up';
import yaml from 'yaml';

const workspaceCommand = new Command('workspace')
  .description('Manage turborepo workspaces');

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

const validateWorkspaceName = (name) => {
  if (!name.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/)) {
    throw new Error('Invalid workspace name. Names must be lowercase and can only contain alphanumeric characters, hyphens, and underscores.');
  }
  return true;
};

const initWorkspace = async () => {
  const packageManager = await detectPackageManager();
  
  // Prompt for workspace details
  const { workspaceName, description, author } = await inquirer.prompt([
    {
      type: 'input',
      name: 'workspaceName',
      message: 'Workspace name:',
      validate: validateWorkspaceName
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

  // Create workspace directory
  const workspaceDir = path.join(process.cwd(), workspaceName);
  if (fs.existsSync(workspaceDir)) {
    console.error(chalk.red(`Error: Directory "${workspaceName}" already exists`));
    process.exit(1);
  }

  // Create workspace structure
  fs.mkdirSync(workspaceDir);
  fs.mkdirSync(path.join(workspaceDir, 'packages'), { recursive: true });
  fs.mkdirSync(path.join(workspaceDir, 'apps'), { recursive: true });

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

  fs.writeFileSync(
    path.join(workspaceDir, 'package.json'), 
    JSON.stringify(packageJson, null, 2)
  );

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

  fs.writeFileSync(
    path.join(workspaceDir, 'turbo.json'), 
    JSON.stringify(turboJson, null, 2)
  );

  // Create pnpm-workspace.yaml if using pnpm
  if (packageManager === 'pnpm') {
    const pnpmWorkspace = {
      packages: ['packages/*', 'apps/*']
    };
    fs.writeFileSync(
      path.join(workspaceDir, 'pnpm-workspace.yaml'), 
      yaml.stringify(pnpmWorkspace)
    );
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

  fs.writeFileSync(
    path.join(workspaceDir, '.gitignore'), 
    gitignore.trim()
  );

  // Create README.md
  const readme = `# ${workspaceName}
${description}

## What's inside?

This turborepo uses [${packageManager}](https://${packageManager}.js.org/) as a package manager. It includes the following packages/apps:

### Apps and Packages

- \`apps/*\`: Application packages
- \`packages/*\`: Shared packages

### Utilities

This turborepo has some additional tools already setup for you:

- [Turbo](https://turbo.build/repo) for task running
${packageManager === 'pnpm' ? '- [pnpm](https://pnpm.io) for package management' : ''}

### Build

To build all apps and packages, run the following command:

\`\`\`
${packageManager} run build
\`\`\`

### Develop

To develop all apps and packages, run the following command:

\`\`\`
${packageManager} run dev
\`\`\`
`;

  fs.writeFileSync(
    path.join(workspaceDir, 'README.md'), 
    readme
  );

  console.log(chalk.green('\nWorkspace initialized successfully!'));
  console.log(chalk.blue('\nNext steps:'));
  console.log(`1. cd ${workspaceName}`);
  console.log(`2. ${packageManager} install`);
  console.log('3. Create your first package:');
  console.log(`   ${packageManager} kabob package create`);
};

workspaceCommand
  .command('init')
  .description('Initialize a new turborepo workspace')
  .action(initWorkspace);

workspaceCommand
  .command('info')
  .description('Display information about the current workspace')
  .action(async () => {
    const packageManager = await detectPackageManager();
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      console.log(chalk.blue('\nWorkspace Information:'));
      console.log(chalk.gray(`Package Manager: ${packageManager}`));
      console.log(chalk.gray(`Name: ${packageJson.name}`));
      console.log(chalk.gray(`Version: ${packageJson.version}`));
      if (packageJson.description) {
        console.log(chalk.gray(`Description: ${packageJson.description}`));
      }
      if (packageJson.author) {
        console.log(chalk.gray(`Author: ${packageJson.author}`));
      }
      console.log(chalk.yellow('\nWorkspace Patterns:'));
      const patterns = packageJson.workspaces || [];
      patterns.forEach(pattern => console.log(`  - ${pattern}`));
    } catch (error) {
      console.error(chalk.red('Error: Not in a valid workspace directory'));
      process.exit(1);
    }
  });

export { workspaceCommand };
