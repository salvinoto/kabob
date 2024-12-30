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

interface WorkspaceDetails {
  name: string;
  description: string;
  author: string;
}

interface TurboConfig {
  $schema: string;
  globalDependencies: string[];
  pipeline: {
    build: {
      dependsOn: string[];
      outputs: string[];
    };
    lint: Record<string, never>;
    dev: {
      cache: boolean;
      persistent: boolean;
    };
    test: Record<string, never>;
  };
}

export const workspaceCommand = new Command('workspace')
  .description('Manage turborepo workspaces');

const validateWorkspaceName = (name: string): boolean => {
  if (!name.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/)) {
    throw new Error('Invalid workspace name. Names must be lowercase and can only contain alphanumeric characters, hyphens, and underscores.');
  }
  return true;
};

const initWorkspace = async (): Promise<void> => {
  try {
    const pm = await detect();
    if (!pm) {
      throw new Error('Could not detect package manager');
    }

    // Prompt for workspace details
    const answers = await inquirer.prompt<WorkspaceDetails>([
      {
        type: 'input',
        name: 'name',
        message: 'Workspace name:',
        validate: validateWorkspaceName
      },
      {
        type: 'input',
        name: 'description',
        message: 'Workspace description:',
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
        message: 'Author:'
      }
    ]);

    // Create workspace directory
    const workspaceDir = path.join(process.cwd(), answers.name);
    if (fs.existsSync(workspaceDir)) {
      throw new Error(`Directory "${answers.name}" already exists`);
    }

    // Create workspace structure
    fs.mkdirSync(workspaceDir);
    fs.mkdirSync(path.join(workspaceDir, 'packages'), { recursive: true });
    fs.mkdirSync(path.join(workspaceDir, 'apps'), { recursive: true });

    // Create root package.json
    const packageJson = {
      name: answers.name,
      version: '0.0.1',
      private: true,
      description: answers.description,
      author: answers.author,
      workspaces: [
        'packages/*',
        'apps/*'
      ],
      scripts: {
        build: 'turbo run build',
        dev: 'turbo run dev',
        lint: 'turbo run lint',
        test: 'turbo run test',
        clean: 'turbo run clean'
      },
      devDependencies: {
        turbo: '^1.10.0',
        typescript: '^5.0.0',
        '@types/node': '^18.0.0',
        eslint: '^8.0.0',
        prettier: '^3.0.0'
      }
    };

    fs.writeFileSync(
      path.join(workspaceDir, 'package.json'), 
      JSON.stringify(packageJson, null, 2)
    );

    // Create turbo.json
    const turboJson: TurboConfig = {
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
    if (pm.name === 'pnpm') {
      const pnpmWorkspace = {
        packages: ['packages/*', 'apps/*']
      };
      fs.writeFileSync(
        path.join(workspaceDir, 'pnpm-workspace.yaml'), 
        yaml.stringify(pnpmWorkspace)
      );
    }

    // Create tsconfig.json
    const tsconfig = {
      $schema: "https://json.schemastore.org/tsconfig",
      compilerOptions: {
        target: "es2017",
        module: "commonjs",
        moduleResolution: "node",
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        strict: true,
        skipLibCheck: true
      }
    };

    fs.writeFileSync(
      path.join(workspaceDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );

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

# typescript
*.tsbuildinfo
`;

    fs.writeFileSync(
      path.join(workspaceDir, '.gitignore'), 
      gitignore.trim()
    );

    // Create README.md
    const installCommand = resolveCommand(pm.name, 'install', []);
    const runCommand = resolveCommand(pm.name, 'run', ['dev']);
    
    if (!installCommand || !runCommand) {
      throw new Error(`Could not resolve commands for ${pm.name}`);
    }

    const readme = `# ${answers.name}

${answers.description}

## What's inside?

This turborepo uses [${pm.name}](https://${pm.name}.js.org/) as a package manager. It includes the following packages/apps:

### Apps and Packages

- \`apps/*\`: Application packages
- \`packages/*\`: Shared packages

### Utilities

This turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
- [Turbo](https://turbo.build/repo) for task running
${pm.name === 'pnpm' ? '- [pnpm](https://pnpm.io) for fast, disk space efficient package management' : ''}

### Build

To build all apps and packages, run the following command:

\`\`\`bash
cd ${answers.name}
${installCommand.command} ${installCommand.args.join(' ')}
${runCommand.command} build
\`\`\`

### Develop

To develop all apps and packages, run the following command:

\`\`\`bash
${runCommand.command} dev
\`\`\`

### Remote Caching

Turborepo can use a technique known as [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup), then enter the following commands:

\`\`\`bash
${runCommand.command} login
\`\`\`
`;

    fs.writeFileSync(
      path.join(workspaceDir, 'README.md'), 
      readme
    );

    console.log(chalk.green(`✓ Created workspace at ${workspaceDir}`));
    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. cd ${answers.name}`);
    console.log(`  2. ${installCommand.command} ${installCommand.args.join(' ')}`);
    console.log('  3. Create your first package with: npx kabob package create');
  } catch (error) {
    console.error(chalk.red('Error creating workspace:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

workspaceCommand
  .command('init')
  .description('Initialize a new turborepo workspace')
  .action(initWorkspace);

workspaceCommand
  .command('info')
  .description('Display information about the current workspace')
  .action(async () => {
    try {
      const pm = await detect();
      if (!pm) {
        throw new Error('Could not detect package manager');
      }

      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error('Not in a valid workspace directory');
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      console.log(chalk.blue('\nWorkspace Information:'));
      console.log(chalk.gray(`Package Manager: ${pm.name}`));
      console.log(chalk.gray(`Name: ${packageJson.name}`));
      console.log(chalk.gray(`Version: ${packageJson.version}`));
      
      if (packageJson.description) {
        console.log(chalk.gray(`Description: ${packageJson.description}`));
      }
      if (packageJson.author) {
        console.log(chalk.gray(`Author: ${packageJson.author}`));
      }

      console.log(chalk.yellow('\nWorkspace Patterns:'));
      let patterns: string[] = [];
      
      if (packageJson.workspaces) {
        patterns = Array.isArray(packageJson.workspaces)
          ? packageJson.workspaces
          : packageJson.workspaces.packages || [];
      }

      if (patterns.length === 0) {
        console.log(chalk.gray('  No workspace patterns defined'));
      } else {
        patterns.forEach(pattern => console.log(chalk.gray(`  - ${pattern}`)));
      }

      // Check for pnpm workspace
      const pnpmWorkspacePath = path.join(process.cwd(), 'pnpm-workspace.yaml');
      if (fs.existsSync(pnpmWorkspacePath)) {
        const pnpmWorkspace = yaml.parse(fs.readFileSync(pnpmWorkspacePath, 'utf8'));
        if (pnpmWorkspace.packages) {
          console.log(chalk.yellow('\npnpm Workspace Patterns:'));
          pnpmWorkspace.packages.forEach((pattern: string) => 
            console.log(chalk.gray(`  - ${pattern}`))
          );
        }
      }

      // Show available scripts
      if (packageJson.scripts) {
        console.log(chalk.yellow('\nAvailable Scripts:'));
        Object.entries(packageJson.scripts).forEach(([name, script]) => 
          console.log(chalk.gray(`  ${name}: ${script}`))
        );
      }

    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
