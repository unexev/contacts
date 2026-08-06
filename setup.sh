#!/bin/bash
set -e

echo "🚀 Iniciando Contacts SaaS..."

# Verificar si Docker está corriendo
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker no está corriendo. Iniciando..."
    sudo systemctl start docker
    sleep 3
fi

# Verificar si PostgreSQL está corriendo
if ! docker ps | grep -q contacts-db; then
    echo "📦 Iniciando PostgreSQL..."
    docker compose up -d
    sleep 5
fi

# Verificar si las variables de entorno existen
if [ ! -f backend/.env ]; then
    echo "⚙️  Creando archivo .env..."
    cp backend/.env.example backend/.env
fi

if [ ! -f web/.env ]; then
    echo "⚙️  Creando archivo .env para frontend..."
    cp web/.env.example web/.env
fi

# Instalar dependencias del frontend si es necesario
if [ ! -d web/node_modules ]; then
    echo "📥 Instalando dependencias del frontend..."
    cd web && npm install && cd ..
fi

echo "✅ Todo listo!"
echo ""
echo "Para iniciar el desarrollo:"
echo "  Terminal 1: cd backend && go run ./cmd/server"
echo "  Terminal 2: cd web && npm run dev"
echo ""
echo "O ejecuta: ./dev.sh"
