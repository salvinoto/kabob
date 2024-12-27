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
```

## Usage

```bash
kabob [command] [options]
```

### Commands

- `install [packages...]`: Install packages in selected workspaces
- `add [packages...]`: Add packages to selected workspaces
- `remove [packages...]`: Remove packages from selected workspaces
- `update [packages...]`: Update packages in selected workspaces

### Options

- `-h, --help`: Display help information
- `-v, --version`: Display version information

## Examples

```bash
# Install dependencies in all workspaces
kabob install --all

# Add a package to specific workspaces
kabob add react --workspace frontend

# Remove a package from selected workspaces
kabob remove lodash

# Update packages in all workspaces
kabob update --all
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
