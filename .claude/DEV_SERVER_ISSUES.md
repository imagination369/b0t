# Dev Server Breaking Issues - Root Causes & Solutions

## The Problem

When running type checking, linting, or fixing operations, the Next.js dev server becomes unresponsive and requires:
1. Killing processes on port 3000
2. Deleting the `.next` cache
3. Restarting the dev server

## Root Causes

### 1. **Multiple Background Dev Server Processes** (Primary Issue)
- **What happens**: Claude Code often starts background processes that don't get properly cleaned up
- **Impact**: You had 14+ dev servers running simultaneously, all trying to:
  - Watch the same files
  - Write to the same `.next` cache
  - Use port 3000
- **Result**: Port conflicts, cache corruption, file watcher conflicts

### 2. **Turbopack Cache Sensitivity**
- **What happens**: Next.js 15 with Turbopack uses aggressive caching for fast builds
- **Problem**: When multiple processes write to the cache simultaneously, it corrupts
- **Trigger**: File changes during type checking/fixing cause all watchers to recompile at once
- **Result**: Cache corruption requires full cleanup

### 3. **Instrumentation File at Startup**
- **Location**: `instrumentation.ts` runs at server start
- **What it does**: Loads scheduler, logger, and all job dependencies
- **Problem**: If ANY TypeScript error exists in the dependency chain:
  - `src/lib/jobs/index.ts`
  - `src/lib/logger.ts`
  - `src/lib/scheduler.ts`
  - Any imported workflows or utilities
- **Result**: Entire app fails to start, not just the page with errors

### 4. **TypeScript Strict Mode + Fast Refresh**
- **Setting**: `"strict": true` in `tsconfig.json`
- **Behavior**: Any type error blocks compilation
- **Problem**: When fixing multiple related files:
  1. First file fixed → triggers recompile
  2. Second file still has error → compilation fails
  3. Fast Refresh tries to recover → fails
  4. Cache gets corrupted trying to hot-reload broken code
- **Result**: Dev server enters broken state

## Solutions Implemented

### 1. Clean Restart Script
Created `.claude/dev-restart.sh` that:
- Kills all processes on port 3000
- Terminates zombie npm/node processes
- Removes `.next` cache
- Starts fresh dev server

**Usage**:
```bash
./.claude/dev-restart.sh
```

### 2. Best Practices for Type Checking/Fixing

**DO**:
- Run `tsc --noEmit` to check for errors WITHOUT triggering builds
- Fix errors in a single commit/session
- Test imports in isolation before restarting dev server
- Use the restart script when making major changes

**DON'T**:
- Run type checks while dev server is building
- Start multiple dev servers in parallel
- Fix errors across many files without testing
- Use `next build` during active development (too slow, cache-heavy)

## Why This Keeps Happening

### The Cycle
1. Type error exists in code
2. Claude runs fix → changes files
3. Turbopack detects change → starts recompile
4. Instrumentation loads → hits error in dependency
5. Compilation fails → cache partially written
6. Fast Refresh tries to recover → fails
7. Dev server stuck in broken state

### Prevention

1. **Before major operations**: Kill background processes
   ```bash
   ps aux | grep "npm run dev" | grep -v grep
   lsof -ti:3000
   ```

2. **Check TypeScript without building**:
   ```bash
   npx tsc --noEmit
   ```

3. **Monitor active dev servers**: Only ONE should run at a time
   ```bash
   lsof -ti:3000  # Should show 1-2 PIDs max
   ```

4. **When fixing errors**: Fix related files together, not incrementally
   - Example: If fixing imports in `fileA.ts` that exports to `fileB.ts`, fix both before saving

## Configuration Notes

### Current Setup
- **Next.js**: 15.5.4 with Turbopack (fast but cache-sensitive)
- **TypeScript**: Strict mode (catches errors aggressively)
- **Instrumentation**: Loads at startup (creates startup dependencies)

### Potential Improvements

**Option 1: Disable Instrumentation in Development**
```typescript
// instrumentation.ts
export async function register() {
  // Only run in production
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeScheduler } = await import('./src/lib/jobs');
    await initializeScheduler();
  }
}
```

**Option 2: Add Turbopack Cache Stability**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    // More stable caching
    turbo: {
      rules: {
        '*.ts': {
          loaders: ['builtin:swc-loader'],
          as: '*.js',
        },
      },
    },
  },
};
```

**Option 3: Relax TypeScript Checking**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "incremental": true,
    // Add this to allow faster rebuilds
    "assumeChangesOnlyAffectDirectDependencies": true
  }
}
```

## When Dev Server Breaks

**Quick Recovery**:
```bash
# Kill everything, start fresh
lsof -ti:3000 | xargs kill -9 2>/dev/null
rm -rf .next
npm run dev
```

**Or use the script**:
```bash
./.claude/dev-restart.sh
```

## Monitoring Health

**Healthy state**:
```bash
$ lsof -ti:3000
57329        # Only ONE process (or maybe 2 for worker)
```

**Unhealthy state**:
```bash
$ lsof -ti:3000
57329
58819
59203
60147
...         # Multiple processes = problem
```

## Summary

The core issue is **background process accumulation** combined with **Turbopack's cache sensitivity**. The instrumentation file makes it worse by creating startup dependencies that propagate TypeScript errors.

**Immediate fix**: Use the restart script
**Long-term fix**: Disable instrumentation in development OR fix errors in batches without incremental saves
