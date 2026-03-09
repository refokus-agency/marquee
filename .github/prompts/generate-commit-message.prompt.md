# Generate Commit Message

Generate a Conventional Commit message from the staged diff.

## Rules

1. Use format: `<type>(<scope>): <subject>`.
2. Keep subject imperative, lowercase, and <= 72 chars.
3. Add a body only when needed for important context.
4. Add footer for breaking changes when applicable.
5. Choose the most accurate type: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`, `ci`.

## Output

Return only the commit message text, ready for `git commit -m`.
