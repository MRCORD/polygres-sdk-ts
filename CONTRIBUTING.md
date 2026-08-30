# Contributing to Polygres TypeScript SDK

Thanks for helping improve the Polygres TypeScript SDK (`polygres-sdk-ts`).

## Development Setup

The SDK requires Node.js 18 or newer (native `fetch` support).

```bash
npm install
```

## Available Scripts

- **Build**: Build ESM and CJS bundles with TypeScript declarations to `dist/`:
  ```bash
  npm run build
  ```
- **Test**: Run test suite via Vitest:
  ```bash
  npm run test
  ```
- **Typecheck**: Verify TypeScript types without emitting:
  ```bash
  npm run typecheck
  ```
- **Lint**: Check code quality:
  ```bash
  npm run lint
  ```

## Checks before PR

Run the following checks before opening a pull request:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

## Scope and Principles

- **Zero Heavy Dependencies**: The SDK relies on native `fetch` and runtime built-ins, ensuring compatibility with Node.js, browsers, Cloudflare Workers, Deno, and Bun.
- **Idiomatic TypeScript**: Strong types for every payload, request, and response shape, exported from the package root.
- **Parity with Python SDK**: Preserves the exact same behavior, namespaces, validation rules, retry policies, and error hierarchies as `polygres-sdk` (Python).
- **Dual API Conventions**: Supports both idiomatic camelCase methods/properties and snake_case aliases to match Python examples directly.
