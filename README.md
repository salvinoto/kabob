# Kabob 🍖

A smart monorepo package manager installer that makes managing dependencies across workspaces a breeze. Kabob automatically detects your package manager (npm, yarn, or pnpm) and provides an interactive interface for managing dependencies across your monorepo workspaces.

## Features

- 🔍 Automatic package manager detection (npm, yarn, pnpm, bun, deno)
- 🎯 Interactive workspace selection
- 📦 Smart internal package management
- 🛠️ Support for development dependencies
- 🔒 Frozen lockfile support
- 🧹 Clean install support
- 💻 Cross-platform compatibility

## Installation

You can run Kabob directly using npx:

```bash
npx kabob
```

Or install it globally:

```bash
npm install -g kabob
or npx kabob [args...]
```

## Usage

### Adding Dependencies

Add external packages:
```bash
npx kabob add package1 package2 [options]
```

Add internal workspace packages:
```bash
npx kabob add --internal            # Interactive selection
npx kabob add --internal pkg1 pkg2  # Specific packages
```

Options:
- `-w, --workspace <workspace>`: Target specific workspace
- `--internal`: Add internal workspace packages
- `-D, --dev`: Add as development dependency

### Removing Dependencies

Remove external packages:
```bash
npx kabob remove package1 package2 [options]
```

Remove internal workspace packages:
```bash
npx kabob remove --internal            # Interactive selection
npx kabob remove --internal pkg1 pkg2  # Specific packages
```

Options:
- `-w, --workspace <workspace>`: Target specific workspace
- `--internal`: Remove internal workspace packages

### Installing Dependencies

Install dependencies in workspaces:
```bash
npx kabob install [options]
```

Options:
- `-w, --workspace <workspace>`: Target specific workspace
- `--clean`: Clean install (like npm ci)
- `--frozen`: Use frozen lockfile

### Updating Dependencies

Update dependencies in workspaces:
```bash
npx kabob update [packages...] [options]
```

Options:
- `-w, --workspace <workspace>`: Target specific workspace
- `--latest`: Update to latest major versions (includes major version bumps)

If no packages are specified, you will be prompted to select from existing dependencies.

### Managing Workspaces

View workspace information:
```bash
npx kabob workspace info
```

### Managing Packages

Kabob provides several commands to manage packages in your monorepo:

```bash
# Add the package generator template to your project
npx kabob package template

# List all packages in your monorepo
npx kabob package list

# Delete a package from your monorepo
npx kabob package delete <package-name>
```

#### Creating New Packages

1. First, add the package generator template to your project:
```bash
npx kabob package template
```
You'll be prompted to choose a package prefix (e.g., @repo, @workspace) that will be used in your package names.

2. Then, create new packages using Turbo's generator:
```bash
npx turbo gen run
```
Follow the prompts to configure your new package.

## Package Manager Support

Kabob automatically detects and supports:
- npm
- yarn
- pnpm

Each command is automatically adapted to use the correct syntax for your package manager.

## Examples

1. Add a package to all workspaces:
```bash
npx kabob add lodash
```

2. Add a development dependency to a specific workspace:
```bash
npx kabob add -D jest --workspace ./packages/my-app
```

3. Add internal packages interactively:
```bash
npx kabob add --internal
```

4. Clean install in all workspaces:
```bash
npx kabob install --clean
```

5. Remove a package from specific workspaces:
```bash
npx kabob remove lodash --workspace ./packages/my-app
```

6. Update packages to their latest versions:
```bash
npx kabob update --latest
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC