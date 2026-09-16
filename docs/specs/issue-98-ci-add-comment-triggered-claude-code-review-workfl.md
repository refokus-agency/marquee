---
issue_number: 98
issue_title: "ci: add comment-triggered Claude code review workflow"
repo: "refokus-agency/marquee"
labels: [enhancement, ci]
plan_level: "full"
depth: "medium"
branch_name: "beogip/ci-add-comment-triggered-claude-code-review-work"
created_at: "2026-09-14T14:41:59Z"
---

# Implementation Plan: #98 — ci: add comment-triggered Claude code review workflow

## Files

| Action | Path | Purpose |
| --- | --- | --- |
| create | `.github/workflows/comment-code-review.yml` | Comment-triggered caller of the platform `code-review.yml` reusable. Header comment documents the pinning and secret-mapping deviations in `pr-ci.yml`'s voice. |

## Codebase Context

- `.github/workflows/pr-ci.yml` — the both-halves pinning precedent (`ci.yml@v1.8.1` + `platform-ref: v1.8.1`). Its comment block is the style template: prose paragraphs, the trade stated explicitly, the divergence from navigation named out loud. Match that voice.
- `.github/workflows/main-release.yml` — the counter-example: `ci.yml@v1` floating alongside `release.yml@v1.10.2` exact. The repo is already inconsistent between its two workflow files; this new file must pick a side and say why.
- `refokus-agency/navigation/.github/workflows/comment-code-review.yml` — the reference implementation (navigation#89). Same permissions, same concurrency, same explicit secret map, `@v1.10.2` — but **no `platform-ref`**. Marquee adds it; that is the deliberate divergence.
- `refokus-agency/time-to-refokus-ai-v2/.github/workflows/pr-code-review.yml` — the explicit single-secret-mapping precedent cited by the issue.
- `refokus-agency/platform/.github/workflows/code-review.yml@v1.10.2` — the `workflow_call` contract: 15 inputs, all `required: false`; 2 secrets (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`), both `required: false`. That optionality is what makes a single-secret mapping legal instead of `secrets: inherit`.
- `.github/dependabot.yml` — the `github-actions` ecosystem **is** enabled (weekly). Directly relevant to Risk 1.
- Verified: platform tags `v1` and `v1.10.2` both resolve to commit `afb47de8f546213d30186e12e540b466b28b9a68` today, so pinning exact changes nothing behaviourally right now.
- Verified: `gh secret list` and `gh variable list` are both empty in this repo. Org-level config not verifiable with current permissions.

## Steps

1. **Create the workflow file** with `name` / `on` / `permissions` / `concurrency` / `jobs` per the issue spec → `.github/workflows/comment-code-review.yml`
   **Done when:** the file exists and `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/comment-code-review.yml'))"` exits 0.

2. **Write the header comment block** documenting all five points: (a) no `pull_request` trigger by design; (b) both halves pinned, with SHA `afb47de8f546213d30186e12e540b466b28b9a68` recorded because tags are mutable; (c) explicit `ANTHROPIC_API_KEY` map instead of `secrets: inherit`, and why marquee's other two callers legitimately differ (package-registry auth); (d) `id-token: write` is load-bearing — without it the OIDC exchange fails and the reusable cannot detect the omission from the inside; (e) Dependabot will bump the `uses:` ref but **not** `platform-ref`, so a bump PR needs a manual second edit.
   **Done when:** the file contains a non-empty comment block naming all five points, and the string `platform-ref` appears both in a comment line and as a `with:` key.

3. **Assert the `workflow_call` contract** — every key passed under `with:` and `secrets:` must exist in platform's `code-review.yml@v1.10.2` `on: workflow_call` block.
   **Done when:** `platform-ref` is the only `with:` key and `ANTHROPIC_API_KEY` the only `secrets:` key, and both are confirmed present in the reusable's v1.10.2 `workflow_call` block via `gh api`.

4. **Confirm credential state** and record it in the PR body (not in the file).
   **Done when:** `gh secret list` output is captured and the "skips green with a `::notice::`" state is stated explicitly in the delivery PR description.

## Interfaces

Single declarative file — the only interface is the reusable workflow contract it consumes:

```
uses: refokus-agency/platform/.github/workflows/code-review.yml@v1.10.2

inputs.platform-ref        : string, default 'main'  → set to "v1.10.2"
secrets.ANTHROPIC_API_KEY  : required false          → ${{ secrets.ANTHROPIC_API_KEY }}
```

All 14 other inputs stay at their defaults: `trigger-phrase: '@claude review'`, `model: claude-sonnet-5`, `opus-model: claude-sonnet-5`, `plugins: code-review@claude-code-plugins`, `plugin-marketplaces`, the read-only `allowed-tools` allowlist, `track-progress: false`, `show-full-output: false`, `fetch-depth: '1'`, `allowed-bots: ''`, `prompt`, `federation-rule-id`, `anthropic-org-id`.

## Function Design

- `comment-code-review.yml` → single job `code-review`, one concern: delegate to the platform reusable. No steps of its own and no guards of its own — all four gates (credential, actor, fork, PR state) live inside the reusable and skip green with a logged reason.

## Acceptance Criteria (EARS)

- **AC-1.** The repository shall contain `.github/workflows/comment-code-review.yml`, and that file shall call `refokus-agency/platform/.github/workflows/code-review.yml`.
- **AC-2.** The workflow shall pin both halves: `uses: ...@v1.10.2` and `with.platform-ref: v1.10.2`.
- **AC-3.** The workflow file shall contain a comment stating the pinning decision and its rationale.
- **AC-4.** The workflow shall grant exactly `contents: read`, `pull-requests: write`, `issues: write`, and `id-token: write`.
- **AC-5.** The workflow shall map `ANTHROPIC_API_KEY` explicitly and shall not use `secrets: inherit`.
- **AC-6.** The workflow shall set `concurrency.group` to `${{ github.workflow }}-${{ github.event.issue.number }}` with `cancel-in-progress: false`.
- **AC-7.** When a comment containing `@claude review` is created on a non-fork open pull request by a user with write access, the workflow shall dispatch the reusable review job.
- **AC-8.** If no Anthropic credential is reachable at run time, then the run shall complete green with a `::notice::` rather than failing the pull request.

## Out of Scope

- Configuring the `ANTHROPIC_API_KEY` secret at repo or org level — org variables are not verifiable with current permissions.
- Changing `main-release.yml`'s floating `ci.yml@v1` to match the pinning convention. Separate inconsistency, separate issue.
- Overriding any reusable input other than `platform-ref` (`prompt`, `model`, `allowed-tools` stay at defaults).
- Adding a `pull_request` trigger or any automatic (non-comment) review path.
- Adding `actionlint` or any workflow YAML linting to CI.

## Edge Cases + Error Handling

| # | Scenario | Source | Handling |
| --- | --- | --- | --- |
| 1 | No credential reachable at run time | [from issue] | Reusable's "Resolve auth" step skips green with a `::notice::`. Documented in the file comment and the PR body. Merging before the credential exists is safe. |
| 2 | Org configures `CLAUDE_CODE_OAUTH_TOKEN` instead of `ANTHROPIC_API_KEY` | [from issue] | A single-secret map forwards nothing. Called out in the comment as the known cost of the narrow mapping; the fix is a one-line addition. The federation-variable path still works, since those are inputs defaulting from `vars`, not secrets. |
| 3 | Comment on a fork-head PR (this repo is public) | [from issue] | Reusable skips green — checking out a fork head while holding repo secrets is a pwn request. No caller-side handling; noted in the comment. |
| 4 | `@claude review` on a Dependabot PR | [from issue] | The default prompt's stop condition posts a decline comment instead of reviewing. Costs a run. Noted in the comment as a marquee-specific caution, given the steady Dependabot traffic here. |
| 5 | Any comment on any issue fires the workflow | [inferred] | The phrase gate lives in the reusable's job `if:`, so the caller job starts and then skips. This is precisely why `cancel-in-progress` must be `false`. |
| 6 | Two `@claude review` comments in quick succession | [inferred] | `cancel-in-progress: false` queues the second behind the first instead of killing a paid run mid-flight. |
| 7 | Dependabot bumps `uses:` but not `platform-ref` | [inferred] | Half-pin drift — the exact failure `pr-ci.yml`'s comment warns about. Mitigated by an explicit warning comment next to `platform-ref` (Risk 1). |
| 8 | Commenter lacks write access / is a bot / PR is closed / review bot self-triggers | [from issue] | The reusable's actor and state gates skip green with a logged reason. No caller-side guard. |

## Done Criteria per Feature

| Feature | Done when |
| --- | --- |
| Workflow file exists and is wired to the reusable | AC-1, AC-2, AC-4, AC-5, AC-6 |
| Pinning + secret-mapping decisions documented | AC-3 |
| End-to-end behaviour on a real PR | AC-7 |
| Safe to merge without credentials | AC-8 |

## Risks

1. **Dependabot half-bump.** The `github-actions` ecosystem is enabled and has bumped platform refs before (commit `0aa9033`). Dependabot rewrites the `uses:` ref but cannot see `platform-ref` inside `with:` — so a bump PR silently produces the very drift the pinning exists to prevent. `pr-ci.yml` carries this same latent hole today.
   → **Mitigation:** an explicit comment directly above `platform-ref` telling the reviewer to bump both lines together. A Dependabot ignore rule would be worse — it freezes the pin forever. Automating the two-line bump is out of scope for this issue.

2. **Tag mutability.** `v1.10.2` is a tag, not a SHA, and tags can be moved.
   → **Mitigation:** record SHA `afb47de8f546213d30186e12e540b466b28b9a68` in the file comment, as navigation#89 did.

3. **Diverging from navigation.** navigation ships `@v1.10.2` with no `platform-ref`; marquee adds it. A future reader diffing the two repos sees an unexplained difference.
   → **Mitigation:** the comment names navigation explicitly and attributes the difference to marquee's `pr-ci.yml` convention, using the same sentence shape `pr-ci.yml` already uses.

4. **Zero local validation.** No `actionlint` anywhere in the repo; a YAML or expression typo only surfaces on GitHub.
   → **Mitigation:** local `yaml.safe_load` parse, plus a real end-to-end `@claude review` on a test PR before closing the issue (AC-7).

No files are generated at runtime by this change, so no `.gitignore` / `.gitkeep` work is needed.

## Test Strategy

- **Static.** Parse the file with `yaml.safe_load` (exit 0). Assert the structural facts behind AC-2, AC-4, AC-5 and AC-6 by reading the parsed tree — not by grepping strings, which would pass on a commented-out line.
- **Contract.** `gh api` the reusable at `v1.10.2` and assert every key this file passes exists in its `on.workflow_call` inputs/secrets. Black-box against the real remote contract; no mocks.
- **End-to-end (AC-7).** Open a throwaway PR in this repo, comment `@claude review`, observe the run. Two acceptable outcomes, both passing: a posted review (credential reachable) or a green skip with a `::notice::` (no credential — AC-8).
- **Explicitly not tested.** The reusable's internal gates. That is platform's test surface, not marquee's.
