# @refokus-agency/package-typescript-tmp

A TypeScript package template for Refokus Agency focused on Webflow CMS sync tools.

## Features

- 🔧 Modern TypeScript configuration with strict mode
- 📦 ES Module support with CommonJS compatibility
- 🧪 Testing setup with Vitest
- 🎨 Code formatting with Prettier
- 🔍 Linting with ESLint (flat config)
- 🏗️ Build pipeline with TypeScript compiler
- 📝 Source maps for debugging

## Requirements

- Node.js >= 22.0.0

> [!WARNING]

This package is not meant to be published or installed. You need to copy this template and setup properly first


## Installation

```bash
npm install @refokus-agency/package-typescript-tmp
```

## Usage

```typescript
import { exampleFunction } from '@refokus-agency/package-typescript-tmp';

exampleFunction(); // Outputs: Hello World
```

## Development

### Available Scripts

#### Building
```bash
npm run build          # Compile TypeScript
npm run build:clean    # Clean and rebuild
npm run build:watch    # Watch mode
```

#### Testing
```bash
npm test               # Run tests
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage
npm run test:ui        # With UI
```

#### Code Quality
```bash
npm run check-types    # Type checking
npm run lint           # Lint and fix
npm run format         # Format code
```

## Project Structure

```
src/
├── index.ts           # Main entry point
└── example/
    └── index.ts       # Example implementations
```

## Publishing

First you need to update package.json version number and create a new git tag.

```bash
npm version major/minor/patch | git tag
```

Then push the commits & tags. This needs to be merged to main afterwards

```bash
git push && git push --tags
```

Finally, run npm publish to run checks & publish the new package vesion.

```bash
npm publish
```


## License

See [LICENSE](LICENSE) file.
