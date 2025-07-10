#!/bin/bash

echo "🚀 Starting Helper AI Development Server (Alternative Ports)"
echo "=============================================="

# Check if required Node.js version is available
if ! command -v nvm &> /dev/null; then
    echo "❌ nvm is not installed. Please install nvm first."
    exit 1
fi

# Source nvm and use correct Node.js version
source ~/.nvm/nvm.sh
nvm use 22.14.0

# Check if services are already running
if ! docker ps | grep -q helperai-nginx-alt; then
    echo "📦 Starting services (Supabase + nginx)..."
    pnpm services:start
else
    echo "✅ Services already running"
fi

# Check if database migrations are needed
echo "🗄️  Applying database migrations..."
pnpm db:migrate

# Start Next.js development server in background
echo "🌐 Starting Next.js development server..."
export PATH=~/.nvm/versions/node/v22.14.0/bin:$PATH
PORT=3010 pnpm next dev --turbopack -H 0.0.0.0 &

# Wait for server to start
sleep 3

echo ""
echo "🎉 Development server is running!"
echo "=============================================="
echo "📱 Main Application:"
echo "   https://helperai.dev:8443"
echo "   https://localhost:8443"
echo ""
echo "🔧 Direct Next.js (bypass nginx):"
echo "   http://localhost:3010"
echo ""
echo "🗄️  Database Studio:"
echo "   http://127.0.0.1:54323"
echo ""
echo "📧 Email Preview:"
echo "   http://localhost:3061"
echo ""
echo "⚠️  Note: Using alternative ports (8443 instead of 443) to avoid conflicts"
echo "=============================================="