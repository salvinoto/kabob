# Kabob 🍖

A smart monorepo package manager installer that simplifies managing dependencies across multiple workspaces.

## Features

- 📦 Automatic package manager detection (npm, yarn, pnpm)
- 🔍 Smart workspace discovery
- 🎯 Interactive workspace selection
- 🚀 Parallel dependency installation
- 💪 Robust error handling and graceful exit management

## Installation

```bash
npm install -g kabob
or npx kabob [args...]
```

## Usage

```bash
kabob [command] [options]
```

### Commands

- `install [packages...]`: Install packages in selected workspaces
- `add [packages...]`: Add packages to selected workspaces
  - `--internal`: Add internal workspace packages as dependencies
- `remove [packages...]`: Remove packages from selected workspaces
  - `--internal`: Remove internal workspace packages from dependencies
- `update [packages...]`: Update packages in selected workspaces
- `workspace init`: Initialize a new turborepo workspace
- `package create [name]`: Create a new package or app in the workspace
- `package delete [name]`: Delete a package from the workspace
- `package list`: List all packages in the workspace

### Options

- `-h, --help`: Display help information
- `-v, --version`: Display version information

## Examples

```bash
# Install dependencies in all workspaces
kabob install --all

# Add a package to specific workspaces
kabob add react --workspace frontend

# Add an internal workspace package as dependency
kabob add --internal @myorg/ui-components --workspace web-app

# Remove a package from selected workspaces
kabob remove lodash

# Remove an internal workspace package from dependencies
kabob remove --internal @myorg/shared-utils

# Update packages in all workspaces
kabob update --all

# Initialize a new turborepo workspace
kabob workspace init

# Create a new package in the workspace
kabob package create @myorg/ui-components

# Create a new app in the workspace
kabob package create my-web-app

# List all packages in the workspace
kabob package list

# Delete a package from the workspace
kabob package delete @myorg/unused-package
```

## Requirements

- Node.js >= 14
- npm, yarn, or pnpm

## Dependencies

- commander: ^11.1.0
- glob: ^10.3.10
- chalk: ^5.3.0
- find-up: ^7.0.0
- yaml: ^2.3.4
- inquirer: ^9.2.12

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
