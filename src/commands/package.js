#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { findUp } from 'find-up';
import yaml from 'yaml';

const packageCommand = new Command('package')
  .description('Manage packages in your turborepo');

const validatePackageName = (name, type = 'package') => {
  // Basic npm package name validation
  if (!name.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/)) {
    throw new Error('Invalid package name. Names must be lowercase and can only contain alphanumeric characters, hyphens, and underscores.');
  }

  // Common naming conventions for packages
  if (type === 'package') {
    // UI components often use 'ui' or 'components'
    if (name.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?ui$/)) {
      console.log(chalk.yellow('Tip: Consider being more specific for UI packages, e.g., "@repo/ui-core", "@repo/ui-components"'));
    }
    // Config packages often use 'config' or 'configs'
    if (name.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?configs?$/)) {
      console.log(chalk.yellow('Tip: Consider being more specific for config packages, e.g., "@repo/eslint-config", "@repo/tsconfig"'));
    }
  }

  // Common naming conventions for apps
  if (type === 'app') {
    // Web apps often use 'web', 'app', or 'client'
    if (name.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?(web|app|client)$/)) {
      console.log(chalk.yellow('Tip: Consider using a more descriptive name for your app, e.g., "admin", "dashboard", "docs"'));
    }
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

const promptPackageDetails = async (name = '', type = 'package') => {
  const rootPackageJson = getRootPackageJson();
  const workspaceScope = rootPackageJson.name ? rootPackageJson.name.split('/')[0] : '';

  // If name is provided with a scope, split it
  let defaultName = name;
  let initialScope = '';
  if (name && name.includes('/')) {
    [initialScope, defaultName] = name.split('/');
    initialScope = initialScope.replace('@', '');
  }

  // First get the type
  const { type: selectedType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Package type:',
      choices: [
        { 
          name: 'Package (shared library, component, or utility)',
          value: 'package'
        },
        { 
          name: 'App (web app, API, or service)',
          value: 'app'
        }
      ],
      default: type
    }
  ]);

  // Then get scope information
  const scopeAnswers = (!name || !name.includes('@')) ? await inquirer.prompt([
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
      when: (answers) => answers.useScope,
      validate: (scope) => {
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
      validate: (input) => {
        const fullName = scopeAnswers.useScope ? `@${scopeAnswers.scope}/${input}` : input;
        try {
          return validatePackageName(fullName, selectedType);
        } catch (error) {
          return error.message;
        }
      }
    },
    {
      type: 'input',
      name: 'description',
      message: 'Package description:',
      validate: (input) => {
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
      validate: (input) => {
        if (!input.match(/^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/)) {
          return 'Invalid version. Please use semantic versioning (e.g., 1.0.0, 0.1.0-beta.1)';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'private',
      message: (answers) => `Is this ${selectedType} private?`,
      default: selectedType === 'app'
    }
  ]);
  
  // Combine all answers and add standard features
  const answers = {
    type: selectedType,
    ...scopeAnswers,
    ...otherAnswers,
    name: scopeAnswers.useScope ? `@${scopeAnswers.scope}/${otherAnswers.packageName}` : otherAnswers.packageName,
    // Standard features for all packages
    features: ['typescript', 'eslint']
  };
  
  return answers;
};

const createPackage = async (name, type = 'package') => {
  // Verify we're in a workspace
  try {
    getRootPackageJson();
  } catch (error) {
    console.error(chalk.red('Error: Not in a turborepo workspace. Run `kabob workspace init` first.'));
    process.exit(1);
  }

  // Update root turbo.json to include dist/** in outputs
  const rootTurboPath = path.join(process.cwd(), 'turbo.json');
  if (fs.existsSync(rootTurboPath)) {
    const turboConfig = JSON.parse(fs.readFileSync(rootTurboPath, 'utf8'));
    if (turboConfig.tasks?.build?.outputs) {
      if (!turboConfig.tasks.build.outputs.includes('dist/**')) {
        turboConfig.tasks.build.outputs.push('dist/**');
        fs.writeFileSync(rootTurboPath, JSON.stringify(turboConfig, null, 2));
      }
    }
  }

  const details = await promptPackageDetails(name, type);
  
  const baseDir = details.type === 'app' ? 'apps' : 'packages';
  
  // Extract the package name without scope for the directory path
  const packageDirName = details.name.includes('/')
    ? details.name.split('/')[1]  // Get the part after @scope/
    : details.name;
    
  const packagePath = path.join(process.cwd(), baseDir, packageDirName);
  
  if (fs.existsSync(packagePath)) {
    console.error(chalk.red(`Error: ${details.type} "${packageDirName}" already exists`));
    process.exit(1);
  }

  // Create directory structure following Turborepo guidelines
  fs.mkdirSync(packagePath, { recursive: true });
  fs.mkdirSync(path.join(packagePath, 'src'), { recursive: true });
  fs.mkdirSync(path.join(packagePath, 'dist'), { recursive: true });

  // Create package.json with proper structure
  const packageJson = {
    name: details.name,
    version: details.version,
    private: details.private,
    type: "module",
    description: details.description,
    author: details.author,
    main: './dist/index.js',
    types: './dist/index.d.ts',
    // Define exports for better package structure
    exports: {
      ".": {
        types: './dist/index.d.ts',
        default: './dist/index.js'
      }
    },
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
      lint: 'eslint .'
    },
    // Standard dependencies for all packages
    devDependencies: {
      "@repo/typescript-config": "*",
      "@repo/eslint-config": "*",
      "typescript": "latest",
      "eslint": "latest"
    }
  };

  fs.writeFileSync(
    path.join(packagePath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create tsconfig.json
  const tsConfig = {
    extends: "@repo/typescript-config/base.json",
    compilerOptions: {
      outDir: "dist",
      rootDir: "src"
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"]
  };

  fs.writeFileSync(
    path.join(packagePath, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );

  // Create source files
  const indexContent = `// Example code - replace with your package implementation
export interface User {
  id: string;
  name: string;
  email: string;
}

export const createUser = (name: string, email: string): User => {
  return {
    id: Math.random().toString(36).substring(7),
    name,
    email,
  };
};\n`;

  fs.writeFileSync(
    path.join(packagePath, 'src', 'index.ts'),
    indexContent
  );

  // Create README.md
  const readme = `# ${details.name}

${details.description}

This package was generated using [Kabob](https://github.com/salvinoto/kabob), a powerful CLI tool for managing Turborepo monorepos.

Visit [kabobtech.com](https://kabobtech.com/) to learn more about how Kabob can help you build and manage your monorepo.

## Installation

To update this package or create new ones, install Kabob:

\`\`\`bash
npx kabob install
\`\`\`

## Package Management

### Add Dependencies
Add a new dependency to this package:
\`\`\`bash
npx kabob add [package-name]
\`\`\`

Add multiple dependencies:
\`\`\`bash
npx kabob add [package-name-1] [package-name-2]
\`\`\`

Add a dev dependency:
\`\`\`bash
npx kabob add -D [package-name]
\`\`\`

### Remove Dependencies
Remove a dependency:
\`\`\`bash
npx kabob remove [package-name]
\`\`\`

Remove multiple dependencies:
\`\`\`bash
npx kabob remove [package-name-1] [package-name-2]
\`\`\`

---
Generated with ❤️ using [Kabob](https://github.com/salvinoto/kabob)
`;

  fs.writeFileSync(
    path.join(packagePath, 'README.md'),
    readme
  );

  console.log(chalk.green(`\nSuccessfully created ${details.type} "${details.name}"`));
  
  // Ask if user wants to build the package
  const { shouldBuild } = await inquirer.prompt([{
    type: 'confirm',
    name: 'shouldBuild',
    message: 'Would you like to build the package now?',
    default: true
  }]);

  if (shouldBuild) {
    console.log(chalk.blue('\nBuilding package...'));
    try {
      const { execSync } = await import('child_process');
      execSync('turbo build', { stdio: 'inherit', cwd: process.cwd() });
      console.log(chalk.green('\nPackage built successfully!'));
    } catch (error) {
      console.error(chalk.red('\nError building package:'), error.message);
    }
  }

  console.log(chalk.blue('\nNext steps:'));
  console.log(`1. cd ${path.relative(process.cwd(), packagePath)}`);
  console.log('2. Install dependencies:');
  console.log(`   npm install`);
  console.log('   Or, simply run npx kabob install from the root repo folder');
  console.log('\n3. Start development:');
  console.log(`   npm run dev`);
};

const deletePackage = async (name) => {
  // Verify we're in a workspace
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
  // Verify we're in a workspace
  const rootPackageJson = getRootPackageJson();
  const workspaces = rootPackageJson.workspaces || ['packages/*', 'apps/*'];
  
  console.log(chalk.blue('\nPackages in workspace:'));
  
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

packageCommand
  .command('create')
  .description('Create a new package or app')
  .argument('[name]', 'name of the package')
  .option('-t, --type <type>', 'type of package (app or package)', 'package')
  .action(async (name, options) => {
    await createPackage(name, options.type);
  });

packageCommand
  .command('delete')
  .description('Delete a package or app')
  .argument('<name>', 'name of the package to delete')
  .action(async (name) => {
    await deletePackage(name);
  });

packageCommand
  .command('list')
  .description('List all packages and apps')
  .action(listPackages);

export { packageCommand };
