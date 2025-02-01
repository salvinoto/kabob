#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { findInternalPackages } from './package.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const shadcnCommand = new Command('shadcn')
  .description('Manage shadcn/ui components in your turborepo');

interface FileToModify {
  filePath: string;
  imports: string[];
}

const findComponentImports = async (directory: string): Promise<FileToModify[]> => {
  const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
    cwd: directory,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**']
  });

  const filesToModify: FileToModify[] = [];
  console.log(chalk.dim(`Scanning directory: ${directory}`));
  console.log(chalk.dim(`Found ${files.length} files to scan`));

  for (const file of files) {
    const filePath = path.join(directory, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Enhanced regex pattern to catch more import variations
    const importMatches = content.match(/import\s*{[^}]*}\s*from\s*["']@\/components\/ui\/[^"']+["'][^;\n]*;?/gm);

    if (importMatches) {
      console.log(chalk.dim(`Found matches in: ${file}`));
      importMatches.forEach(match => console.log(chalk.dim(`  ${match.trim()}`)));
      
      filesToModify.push({
        filePath,
        imports: importMatches
      });
    }
  }

  return filesToModify;
};

const transformImports = async (): Promise<void> => {
  try {
    const workspaces = await findInternalPackages();
    const appsAndPackages = workspaces.filter(ws => 
      ws.path.includes('/apps/') || ws.path.includes('/packages/')
    );

    console.log(chalk.blue('\nScanning for shadcn/ui component imports...'));

    const allFilesToModify: FileToModify[] = [];
    for (const workspace of appsAndPackages) {
      const files = await findComponentImports(workspace.path);
      allFilesToModify.push(...files);
    }

    if (allFilesToModify.length === 0) {
      console.log(chalk.yellow('\nNo shadcn/ui component imports found to modify.'));
      return;
    }

    console.log(chalk.yellow('\nFiles to be modified:'));
    allFilesToModify.forEach(file => {
      console.log(chalk.gray(`\n${file.filePath}`));
      file.imports.forEach(imp => {
        console.log(chalk.dim(`  ${imp}`));
      });
    });

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: '\nDo you want to proceed with modifying these imports?',
      default: false
    }]);

    if (!confirm) {
      console.log(chalk.yellow('\nOperation cancelled'));
      return;
    }

    for (const file of allFilesToModify) {
      let content = fs.readFileSync(file.filePath, 'utf8');
      const originalContent = content;
      
      // Transform imports
      content = content.replace(
        /import\s*{([^}]+)}\s*from\s*['"](\@?\/components\/ui\/[^'"]+)['"][^;\n]*;?/gm,
        (_, imports, path) => {
          const componentName = path.split('/').pop();
          return `import {${imports}} from "@workspace/ui/components/${componentName}";`;
        }
      );

      // Only write if content has actually changed
      if (content !== originalContent) {
        try {
          fs.writeFileSync(file.filePath, content);
          
          // Verify the file was actually modified
          const verifiedContent = fs.readFileSync(file.filePath, 'utf8');
          if (verifiedContent !== content) {
            throw new Error(`Failed to verify changes in ${file.filePath}`);
          }
        } catch (error) {
          console.error(chalk.red(`Error modifying ${file.filePath}: ${error instanceof Error ? error.message : String(error)}`));
          continue;
        }
      }
    }

    const modifiedFiles = allFilesToModify.filter(file => {
      const currentContent = fs.readFileSync(file.filePath, 'utf8');
      return currentContent.includes('@workspace/ui/components/');
    });

    if (modifiedFiles.length > 0) {
      console.log(chalk.green(`\n✓ Successfully modified ${modifiedFiles.length} files`));
      modifiedFiles.forEach(file => {
        console.log(chalk.gray(`  - ${file.filePath}`));
      });
    } else {
      console.log(chalk.yellow('\nNo files were modified. All imports may already be in the correct format.'));
    }
  } catch (error) {
    console.error(chalk.red('\nError transforming imports:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

shadcnCommand
  .command('transform')
  .description('Transform shadcn/ui component imports to use workspace package')
  .action(transformImports);