import fs from 'fs';
import path from 'path';
import { readFileSync } from 'fs';

// Add dependencies to package.json
export function addDependencies(workspacePath, dependencies, packageManager) {
  const pkgJsonPath = path.join(workspacePath, 'package.json');
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));

  // Initialize dependencies object if it doesn't exist
  if (!pkgJson.dependencies) {
    pkgJson.dependencies = {};
  }

  // Add each dependency with appropriate version syntax
  for (const dep of dependencies) {
    // Handle the case where package name might contain 'workspace'
    const name = dep.replace(/@workspace:$/, '');  // Remove trailing @workspace: if present
    
    // pnpm requires workspace:* protocol, npm and yarn can use *
    pkgJson.dependencies[name] = packageManager === 'pnpm' ? 'workspace:*' : '*';
  }

  // Write back to package.json
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
}

// Remove dependencies from package.json
export function removeDependencies(workspacePath, dependencies) {
  const pkgJsonPath = path.join(workspacePath, 'package.json');
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));

  if (pkgJson.dependencies) {
    for (const dep of dependencies) {
      // Handle the case where package name might contain 'workspace'
      const name = dep.replace(/@workspace:$/, '');  // Remove trailing @workspace: if present
      
      delete pkgJson.dependencies[name];
    }
  }

  // Write back to package.json
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
}
