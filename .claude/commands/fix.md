---
name: fix
description: Run typechecking and linting, then spawn parallel agents to fix all issues
---

# Project Code Quality Check

This command runs all linting and typechecking tools for this project, collects errors, groups them by domain, and spawns parallel agents to fix them.

## Step 1: Run Linting and Typechecking

Run the following commands for this Next.js/TypeScript project:

```bash
npm run typecheck  # TypeScript type checking (safe to run alongside dev server)
npm run lint       # ESLint with Next.js config
```

## Step 2: Collect and Parse Errors

Parse the output from the build and linting commands. Group errors by domain:
- **Type errors**: TypeScript errors from the Next.js build process
- **Lint errors**: ESLint issues (warnings and errors)
- **Build errors**: Other build-related issues

Create a list of all files with issues and the specific problems in each file.

## Step 3: Spawn Parallel Agents

**IMPORTANT**: Use a SINGLE response with MULTIPLE Task tool calls to run agents in parallel.

For each domain that has issues, spawn an agent in parallel using the Task tool:

- Spawn a **"type-fixer"** agent for TypeScript type errors with subagent_type=general-purpose
- Spawn a **"lint-fixer"** agent for ESLint errors with subagent_type=general-purpose

Each agent should:
1. Receive the list of files and specific errors in their domain
2. Fix all errors in their domain systematically
3. Run the relevant check command to verify fixes (`npm run typecheck` for types, `npm run lint` for lint errors)
4. Report completion with a summary of what was fixed

## Step 4: Verify All Fixes

After all agents complete, run the full check again to ensure all issues are resolved:

```bash
npm run typecheck
npm run lint
```

If issues remain, repeat the process or fix remaining issues directly.
