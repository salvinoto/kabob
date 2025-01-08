# Monorepo Management Cheatsheet 🚀

## Package Management with Kabob

### Basic Commands
```bash
# Install Kabob globally
npm install -g kabob

# Add external packages
npx kabob add package1 package2
npx kabob add -w workspace1 package1  # Add to specific workspace

# Add internal workspace packages
npx kabob add --internal              # Interactive selection
npx kabob add --internal pkg1 pkg2    # Specific packages

# Remove packages
npx kabob remove package1 package2
npx kabob remove --internal           # Remove internal packages

# Install dependencies
npx kabob install                     # Normal install
npx kabob install --clean            # Clean install
npx kabob install --frozen           # Use frozen lockfile

# Update dependencies
npx kabob update                      # Interactive update
npx kabob update package1 --latest    # Update specific package to latest
```

### Package Management
```bash
# List all packages in the monorepo
npx kabob package list

# Add package generator template
npx kabob package template

# Delete a package
npx kabob package delete <package-name>
```

## Turborepo Commands

### Basic Turbo Commands
```bash
# Run a specific task
pnpm turbo run <task>

# Run multiple tasks
pnpm turbo run build test lint

# Run task in specific workspace
pnpm turbo run build --filter=workspace1

# Clean turbo cache
pnpm turbo clean
```

### Sherif (Monorepo Maintenance)
```bash
# Run Sherif checks
pnpm dlx sherif@latest

# Auto-fix issues
pnpm dlx sherif@latest --fix

# Check specific workspace
pnpm dlx sherif@latest --scope workspace1
```

## Shadcn/ui in Monorepo

### Setup and Installation
```bash
# Initialize shadcn/ui
pnpm dlx shadcn@latest init

# Add components (to apps/web)
pnpm dlx shadcn@latest add button -c apps/web

# Add multiple components
pnpm dlx shadcn@latest add button card toast -c apps/web
```

### Component Location
- UI components are stored in: `packages/ui/src/components`
- Styles are managed through: `tailwind.config.ts`
- Global styles: `globals.css`

## Best Practices

### Workspace Management
- Keep shared components in `packages/ui`
- Use `--filter` to target specific workspaces
- Maintain consistent versioning across packages

### Performance
- Use turbo cache for faster builds
- Run tasks in parallel when possible
- Use `--cache-dir` to specify custom cache location

### Maintenance
- Run Sherif regularly to catch issues
- Keep dependencies up to date
- Use frozen lockfiles in CI/CD
