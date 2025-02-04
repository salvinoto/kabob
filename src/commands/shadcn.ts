#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { findInternalPackages } from './package.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const shadcnCommand = new Command('shadcn')
  .description('Manage shadcn/ui components in your turborepo');

const transformImports = async (): Promise<void> => {
  try {
    const workspaces = await findInternalPackages();
    const appsAndPackages = workspaces.filter(ws => 
      ws.path.includes('/apps/') || ws.path.includes('/packages/')
    );

    console.log(chalk.blue('\nTransforming shadcn/ui component imports...'));

    // Path to the transform script
    const transformPath = join(__dirname, '..', 'transforms', 'shadcn.js');

    // Create a temporary parser config file
    const parserConfig = {
      sourceType: "module",
      plugins: ["jsx", "typescript"]
    };
    const tempConfigPath = path.join(os.tmpdir(), 'jscodeshift-parser-config.json');
    fs.writeFileSync(tempConfigPath, JSON.stringify(parserConfig, null, 2));

    try {
      for (const workspace of appsAndPackages) {
        console.log(chalk.dim(`\nProcessing workspace: ${workspace.path}`));
        
        try {
          // Run jscodeshift for each workspace
          const result = execSync(
            `npx jscodeshift -t "${transformPath}" "${workspace.path}" --parser=babel --extensions=ts,tsx,js,jsx --ignore-pattern="**/node_modules/**,**/dist/**,**/build/**,**/.next/**,.git" --parser-config="${tempConfigPath}"`,
            { encoding: 'utf8' }
          );
          
          console.log(chalk.dim(result));
        } catch (error) {
          // jscodeshift returns non-zero exit code even for partial successes, so we'll just log the output
          if (error instanceof Error && 'stdout' in error) {
            console.log(chalk.dim((error as any).stdout));
          }
        }
      }
    } finally {
      // Clean up the temporary config file
      try {
        fs.unlinkSync(tempConfigPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    console.log(chalk.green('\n✓ Transformation complete'));
    console.log(chalk.dim('Note: Check the output above for any files that were modified'));

  } catch (error) {
    console.error(chalk.red('\nError transforming imports:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

shadcnCommand
  .command('transform')
  .description('Transform shadcn/ui component imports to use workspace package')
  .action(transformImports);