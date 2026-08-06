#!/bin/bash
set -e

echo "🚀 Iniciando entorno de desarrollo..."

# Verificar si PostgreSQL está corriendo
if ! docker ps | grep -q contacts-db; then
    echo "📦 Iniciando PostgreSQL..."
    docker compose up -d
    sleep 5
fi

# Iniciar backend en background
echo "🔧 Iniciando backend..."
cd backend
go run ./cmd/server &
BACKEND_PID=$!
cd ..

# Esperar a que el backend esté listo
sleep 3

# Iniciar frontend
echo "🎨 Iniciando frontend..."
cd web
npm run dev &
FRONTEND_PID=$!
cd ..

echo "✅ Entorno de desarrollo iniciado!"
echo ""
echo "Backend: http://localhost:8080"
echo "Frontend: http://localhost:5173"
echo ""
echo "Presiona Ctrl+C para detener todos los servicios"

# Capturar Ctrl+C y limpiar
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Servicios detenidos"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Esperar a que terminen los procesos
wait
