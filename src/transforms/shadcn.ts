import { API, FileInfo, Options } from 'jscodeshift';

export default function transformer(
  file: FileInfo,
  api: API,
  options: Options,
) {
  // Skip files in node_modules
  if (file.path.includes('node_modules')) {
    return file.source;
  }

  const j = api.jscodeshift;
  
  try {
    const root = j(file.source);

    // Find all import declarations
    const result = root
      .find(j.ImportDeclaration)
      .forEach(path => {
        const importPath = path.node.source.value;
        
        // Check if this is a shadcn component import
        if (
          typeof importPath === 'string' &&
          (importPath.startsWith('@/components/ui/') || importPath.startsWith('/components/ui/'))
        ) {
          // Get the component name from the last part of the path
          const componentName = importPath.split('/').pop();
          
          // Create the new import path
          const newImportPath = `@workspace/ui/components/${componentName}`;
          
          // Update the source value while preserving the imports
          path.node.source = j.stringLiteral(newImportPath);
        }
      })
      .toSource({
        quote: 'single',
        trailingComma: true,
      });

    return result;
  } catch (error) {
    console.error(`Error processing file ${file.path}:`, error);
    return file.source; // Return original source on error
  }
}

// For testing
export const parser = 'tsx';
