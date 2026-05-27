#!/bin/bash
# =====================================================
# LinguaLearn — Quick Fix & Build Script
# Run this from ~/myLastLingo directory
# =====================================================

set -e

echo "🔄 Pulling latest changes from GitHub..."
git pull origin main

echo "🗑️  Clearing Next.js cache..."
rm -rf frontend/.next

echo "✅ Running build..."
cd frontend
npx next build

echo "🎉 Build complete!"
