export interface PackageDetails {
  name: string;
  version: string;
  description?: string;
  author?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
  template?: string;
}

export interface ScopeAnswers {
  useScope: boolean;
  scope?: string;
}

export interface Workspace {
  path: string;
  packageJson: PackageDetails;
}

export type PackageType = 'package' | 'app';

export interface PackageManagerCommands {
  install: string[];
  add: string[];
  remove: string[];
  run: string[];
}

export interface WorkspaceConfig {
  packages: string[];
}
