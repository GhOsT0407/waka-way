
# 0008 — Commit only the 3 explicitly-flagged components, not the full working tree

**Date:** 2026-07-02
**Status:** Decided, applied

## Context

`git status` at the time showed a large amount of pre-existing uncommitted work beyond the 3 components on the punch list — modified `MapView.tsx`, `ThemeContext.tsx`, several screens, and deleted files (`incidentService.ts`, `mapboxInit.ts`, `supabase_rpc_confirm_dismiss.sql`) that looked like in-progress changes unrelated to this session's work.

## Decision

Staged and committed only `FareDisputeModal.tsx`, `LiveAlertsFeed.tsx`, `QuickReportBar.tsx` by explicit filename (`git add <files>`, not `git add -A`/`.`).

## Why

The checklist item specifically named those 3 files. Bundling in the rest of the working tree would have swept unreviewed, unrelated in-progress work into a commit without the user's review — high blast radius for a low-value shortcut. Matches the standing git-safety practice of staging specific files by name.

## Affected files
- `client/src/components/FareDisputeModal.tsx`
- `client/src/components/LiveAlertsFeed.tsx`
- `client/src/components/QuickReportBar.tsx`
- (git history: commit `be56f76`)
