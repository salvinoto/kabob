import { API, FileInfo, Options } from 'jscodeshift';

// Define import mappings for shadcn-related paths
const IMPORT_MAPPINGS = [
  {
    from: '@/components/ui/',
    to: '@workspace/ui/components/'
  },
  {
    from: '/components/ui/',
    to: '@workspace/ui/components/'
  },
  {
    from: '@/lib/',
    to: '@workspace/ui/lib/'
  },
  {
    from: '/lib/',
    to: '@workspace/ui/lib/'
  },
  {
    from: '@/hooks/',
    to: '@workspace/ui/hooks/'
  },
  {
    from: '/hooks/',
    to: '@workspace/ui/hooks/'
  }
];

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
        
        if (typeof importPath !== 'string') return;

        // Check each mapping pattern
        for (const mapping of IMPORT_MAPPINGS) {
          if (importPath.startsWith(mapping.from)) {
            // Get the remaining path after the prefix
            const relativePath = importPath.slice(mapping.from.length);
            // Create the new import path
            const newImportPath = `${mapping.to}${relativePath}`;
            // Update the source value while preserving the imports
            path.node.source = j.stringLiteral(newImportPath);
            break; // Stop after first match
          }
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

// Configure the parser
export const parser = 'tsx';
