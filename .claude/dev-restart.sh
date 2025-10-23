#!/bin/bash
# Dev server clean restart script
# Safely restarts the Next.js dev server without leaving zombie processes

echo "🧹 Cleaning up old processes..."

# Kill any processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Wait for port to be fully released
sleep 1

# Kill any npm/node processes related to this project
pkill -f "next dev" 2>/dev/null || true
pkill -f "social-cat.*npm" 2>/dev/null || true

# Wait for processes to terminate
sleep 1

echo "🗑️  Removing Next.js cache..."
rm -rf .next

echo "🚀 Starting dev server..."
npm run dev
