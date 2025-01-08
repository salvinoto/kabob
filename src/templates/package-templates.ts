import type { PackageJson } from 'type-fest';

export interface PackageTemplate {
  name: string;
  description: string;
  packageJson: Partial<PackageJson>;
  tsconfig: Record<string, any>;
  files?: Record<string, string>; // Additional files to create
  dependencies?: string[];
  devDependencies?: string[];
}

export const templates: Record<string, PackageTemplate> = {
  'basic-jit': {
    name: 'Basic TypeScript Package (JIT)',
    description: 'A simple TypeScript package with JIT compilation',
    packageJson: {
      scripts: {
        dev: 'tsx watch src/index.ts',
        start: 'tsx src/index.ts',
        test: 'jest',
        lint: 'eslint .',
        typecheck: 'tsc --noEmit'
      }
    },
    tsconfig: {
      extends: '../../tsconfig.json',
      compilerOptions: {
        esModuleInterop: true,
        skipLibCheck: true,
        target: "es2022",
        allowJs: true,
        resolveJsonModule: true,
        moduleDetection: "force",
        isolatedModules: true,
        verbatimModuleSyntax: true,
        strict: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        module: "preserve",
        noEmit: true,
        lib: ["es2022"]
      },
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["node_modules"]
    },
    devDependencies: [
      'typescript',
      '@types/node',
      'tsx'
    ]
  },

  'basic-aot': {
    name: 'Basic TypeScript Package (AOT)',
    description: 'A simple TypeScript package with AOT compilation',
    packageJson: {
      scripts: {
        build: 'tsc',
        dev: 'tsc --watch',
        start: 'node dist/index.js',
        test: 'jest',
        lint: 'eslint .',
        clean: 'rm -rf dist'
      }
    },
    tsconfig: {
      extends: '../../tsconfig.json',
      compilerOptions: {
        esModuleInterop: true,
        skipLibCheck: true,
        target: "es2022",
        allowJs: true,
        resolveJsonModule: true,
        moduleDetection: "force",
        isolatedModules: true,
        verbatimModuleSyntax: true,
        strict: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        module: "NodeNext",
        outDir: "./dist",
        rootDir: "./src",
        declaration: true,
        sourceMap: true
      },
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["node_modules", "dist"]
    },
    devDependencies: [
      'typescript',
      '@types/node'
    ]
  },

  'react-jit': {
    name: 'React Component Library (JIT)',
    description: 'A React component library with JIT compilation',
    packageJson: {
      scripts: {
        dev: 'vite',
        test: 'jest',
        lint: 'eslint .',
        typecheck: 'tsc --noEmit',
        storybook: 'storybook dev -p 6006',
        'build-storybook': 'storybook build'
      }
    },
    tsconfig: {
      extends: '../../tsconfig.json',
      compilerOptions: {
        esModuleInterop: true,
        skipLibCheck: true,
        target: "es2022",
        allowJs: true,
        resolveJsonModule: true,
        moduleDetection: "force",
        isolatedModules: true,
        verbatimModuleSyntax: true,
        strict: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        module: "preserve",
        noEmit: true,
        lib: ["es2022", "DOM", "DOM.Iterable"],
        jsx: "react-jsx"
      },
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["node_modules"]
    },
    dependencies: [
      'react',
      'react-dom'
    ],
    devDependencies: [
      'typescript',
      '@types/node',
      '@types/react',
      '@types/react-dom',
      'vite',
      '@vitejs/plugin-react',
      '@storybook/react-vite',
      '@storybook/addon-essentials',
      '@testing-library/react',
      '@testing-library/jest-dom'
    ]
  },

  'react-aot': {
    name: 'React Component Library (AOT)',
    description: 'A React component library with AOT compilation',
    packageJson: {
      scripts: {
        build: 'tsup',
        dev: 'tsup --watch',
        test: 'jest',
        lint: 'eslint .',
        storybook: 'storybook dev -p 6006',
        'build-storybook': 'storybook build'
      }
    },
    tsconfig: {
      extends: '../../tsconfig.json',
      compilerOptions: {
        esModuleInterop: true,
        skipLibCheck: true,
        target: "es2022",
        allowJs: true,
        resolveJsonModule: true,
        moduleDetection: "force",
        isolatedModules: true,
        verbatimModuleSyntax: true,
        strict: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        module: "NodeNext",
        outDir: "./dist",
        rootDir: "./src",
        declaration: true,
        sourceMap: true,
        jsx: "react-jsx"
      },
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["node_modules", "dist"]
    },
    dependencies: [
      'react',
      'react-dom'
    ],
    devDependencies: [
      'typescript',
      '@types/node',
      '@types/react',
      '@types/react-dom',
      'tsup',
      '@storybook/react',
      '@storybook/builder-webpack5',
      '@testing-library/react',
      '@testing-library/jest-dom'
    ]
  },

  'node-api-jit': {
    name: 'Node.js API Package (JIT)',
    description: 'A Node.js API package with JIT compilation',
    packageJson: {
      scripts: {
        dev: 'tsx watch src/index.ts',
        start: 'tsx src/index.ts',
        test: 'jest',
        lint: 'eslint .',
        typecheck: 'tsc --noEmit'
      },
      type: 'module'
    },
    tsconfig: {
      extends: '../../tsconfig.json',
      compilerOptions: {
        esModuleInterop: true,
        skipLibCheck: true,
        target: "es2022",
        allowJs: true,
        resolveJsonModule: true,
        moduleDetection: "force",
        isolatedModules: true,
        verbatimModuleSyntax: true,
        strict: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        module: "preserve",
        noEmit: true,
        lib: ["es2022"]
      },
      include: ["src/**/*.ts"],
      exclude: ["node_modules"]
    },
    dependencies: [
      'express',
      'cors',
      'helmet'
    ],
    devDependencies: [
      'typescript',
      '@types/node',
      '@types/express',
      '@types/cors',
      'tsx',
      'supertest',
      '@types/supertest'
    ]
  },

  'node-api-aot': {
    name: 'Node.js API Package (AOT)',
    description: 'A Node.js API package with AOT compilation',
    packageJson: {
      scripts: {
        build: 'tsc',
        dev: 'ts-node-dev --respawn src/index.ts',
        start: 'node dist/index.js',
        test: 'jest',
        lint: 'eslint .',
        clean: 'rm -rf dist'
      },
      type: 'module'
    },
    tsconfig: {
      extends: '../../tsconfig.json',
      compilerOptions: {
        esModuleInterop: true,
        skipLibCheck: true,
        target: "es2022",
        allowJs: true,
        resolveJsonModule: true,
        moduleDetection: "force",
        isolatedModules: true,
        verbatimModuleSyntax: true,
        strict: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        module: "NodeNext",
        outDir: "./dist",
        rootDir: "./src",
        declaration: true,
        sourceMap: true
      },
      include: ["src/**/*.ts"],
      exclude: ["node_modules", "dist"]
    },
    dependencies: [
      'express',
      'cors',
      'helmet'
    ],
    devDependencies: [
      'typescript',
      '@types/node',
      '@types/express',
      '@types/cors',
      'ts-node-dev',
      'supertest',
      '@types/supertest'
    ]
  }
};

export const getTemplate = (templateName: string): PackageTemplate => {
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Template not found: ${templateName}`);
  }
  return template;
};

export const listTemplates = (): Array<{ name: string; description: string }> => {
  return Object.entries(templates).map(([key, template]) => ({
    name: `${template.name} (${key})`,
    description: template.description
  }));
};
