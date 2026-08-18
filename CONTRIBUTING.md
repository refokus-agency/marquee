# Contributing to @refokus-agency/marquee

Thanks for your interest in improving this package. This guide covers everything
you need to get a change from your machine into `main`.

For AI-agent-facing conventions — architecture, naming, import order, test
patterns — see [AGENTS.md](AGENTS.md). This guide is the human-facing companion
and stays task-oriented.

## How to Contribute

1. **Fork** the repository to your own account.
2. **Branch from `main`** using the repository convention
   `<type>/<issue-number>-<slug>`, for example `fix/25-browser-bundle-filename`
   or `docs/16-contributing-md`. Use the same type prefixes as commits (see
   [Commit Conventions](#commit-conventions)).
3. **Make your change**, with tests when the change touches behavior.
4. **Open a pull request against `main`**.

Every change should trace back to an issue. If one does not exist yet, open it
first — see [Submitting Issues](#submitting-issues).

## Development Setup

**Requirements**

- **Node.js >= 22.0.0** (`engines.node`). `.nvmrc` pins `v22.14.0` — run
  `nvm use` to match it.
- **pnpm** — the canonical package manager. `pnpm-lock.yaml` is the committed
  lockfile, and CI installs with `--frozen-lockfile`. Do not use `npm install`
  or `yarn`: they will not read this lockfile and may produce a different
  dependency tree.
- **GSAP >= 3.12.0** — a peer dependency, not bundled. It is installed as a dev
  dependency so tests and the local build work out of the box.

> **Heads up on Node versions.** CI resolves the package manager from the
> committed lockfile and runs **pnpm 10 on Node 24** — not the version in
> `.nvmrc`, and the `packageManager` field in `package.json` is not read. Code
> that passes locally on Node 22 can still fail on Node 24. If a CI failure
> looks impossible to reproduce, try Node 24 locally before digging further.

**Commands**

```bash
pnpm install           # install dependencies
pnpm test              # run the test suite once (Vitest)
pnpm test:watch        # run tests in watch mode
pnpm test:coverage     # run tests with a coverage report
pnpm typecheck         # TypeScript type check, no emit — the name CI probes for
pnpm lint              # Biome lint, WRITES fixes to ./src
pnpm lint:report       # Biome lint, read-only — use this to verify
pnpm format            # Biome format, writes to ./src
pnpm build             # compile TypeScript, then build the browser bundle
pnpm build:clean       # remove dist and rebuild
pnpm commit            # Conventional Commit wizard
```

`pnpm lint` and `pnpm format` both carry `--write` and modify your files. When
you only want to *check* whether linting passes, use `pnpm lint:report` — it
reports without mutating anything, which is what you want inside a verification
chain.

To run a single test file or pattern:

```bash
pnpm exec vitest run src/__tests__/index.test.ts   # one file
pnpm exec vitest run -t "should export"            # by test name
```

## Submitting Issues

Blank issues are disabled — every report goes through a template so we get the
information needed to act on it.

Open an issue via
**[/issues/new/choose](https://github.com/refokus-agency/marquee/issues/new/choose)**
and pick the template that fits:

- **Bug report** — something behaves incorrectly.
- **Feature request** — something should exist that does not.

One thing does **not** belong in an issue: **security vulnerabilities**. Report
those privately via
[a security advisory](https://github.com/refokus-agency/marquee/security/advisories/new).
Never disclose a vulnerability in a public issue. See [SECURITY.md](SECURITY.md)
for the full policy.

## Submitting Pull Requests

Before you open the PR, run the same checks CI runs, in the same order:

```bash
pnpm lint:report && pnpm typecheck && pnpm test && pnpm build
```

Then:

1. **Fill in the pull request template.** It is applied automatically.
2. **Link the issue** your change resolves.
3. **Keep the PR focused.** One logical change per pull request — it reviews
   faster and reverts cleanly.
4. **Update the docs** when behavior changes. `README.md` documents the public
   API; `AGENTS.md` documents conventions.

**Continuous integration.** The `Pull Request` workflow runs on every pull
request and delegates to the shared Refokus platform pipeline, which runs
**lint, typecheck, test and build** in that order. Your PR must be green before
review — treat a red check as a change that is not ready, not as a technicality.

If your PR shows no `Pull Request` check at all, your branch predates the
workflow — rebase onto `main`.

## Code Style

**[Biome](https://biomejs.dev/)** handles both linting and formatting. The
configuration lives in [`biome.json`](biome.json) and is the single source of
truth — run `pnpm format` rather than matching the rules by hand.

The essentials:

- 2-space indentation, no tabs
- Single quotes
- Semicolons always
- Trailing commas everywhere
- 80-character line width

TypeScript runs in strict mode via `@total-typescript/tsconfig`. Import file
extensions explicitly (`./types.ts`), prefer named imports, and use
`import type` for type-only imports.

Biome's recommended preset is **off** — only the rules listed in `biome.json`
run. See the Code Style section of [AGENTS.md](AGENTS.md) for the full rule
rationale.

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/).
The commit type is not cosmetic: it drives the released version number (see
[Releases](#releases)).

Run the wizard and it will build the message for you — it is Commitizen with the
`cz-conventional-changelog` adapter, configured in `.cz.json`:

```bash
pnpm commit
```

These are the types the wizard offers, and the only ones it accepts:

| Type       | Use for                                        |
| ---------- | ---------------------------------------------- |
| `feat`     | a new feature                                  |
| `fix`      | a bug fix                                      |
| `docs`     | documentation only                             |
| `style`    | formatting, no behavior change                 |
| `refactor` | restructuring, no behavior change              |
| `perf`     | a change that improves performance             |
| `test`     | adding or fixing tests                         |
| `build`    | build system or dependencies                   |
| `ci`       | CI configuration and scripts                   |
| `chore`    | tooling, dependencies, repository housekeeping |
| `revert`   | reverts a previous commit                      |

Examples:

```
feat(marquee): add pause on hover functionality
fix(marquee): correct clone calculation on resize
docs(readme): update HTML structure example
```

**These conventions are not machine-enforced.** There is no commit-msg hook and
no commitlint step, so a malformed commit will be accepted by Git without
complaint — and then silently produce the wrong version bump, or none at all.
Review is the only thing that catches it. Please use `pnpm commit`.

## Releases

Releases are fully automated by
[semantic-release](https://semantic-release.gitbook.io/) when a change merges to
`main`. `@semantic-release/commit-analyzer` reads the commit types in the merge
and derives the next version from them.

Two rules follow from that, and both matter:

- **Never bump the version in `package.json` manually.** It is deliberately
  pinned to `0.0.0-development`. That placeholder is correct — the real version
  is computed at release time. Editing it does not change what gets published;
  it just creates a confusing diff.
- **Never publish by hand.** No `npm publish`, no `pnpm publish`. Publishing is
  the release pipeline's job, and running it locally can ship an unreviewed
  build.

Write a good commit type and the version takes care of itself.

## Response Time

We aim to respond to new issues and pull requests within **5 business days**.
This is an open-source package maintained alongside client work, so review may
take longer during busy periods — a follow-up comment after a week of silence
is welcome, not a nuisance.

Security reports follow the timeline in [SECURITY.md](SECURITY.md).

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md). By
participating, you are expected to uphold it. Report unacceptable behavior to
packages@refokus.com.

## License

Contributions are made under the same license as the project. See
[LICENSE](LICENSE).
