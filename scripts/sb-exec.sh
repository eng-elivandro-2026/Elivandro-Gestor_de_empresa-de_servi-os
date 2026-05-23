#!/usr/bin/env bash
# =============================================================
# sb-exec.sh — Executor de SQL/migrations no Supabase via API
# Uso: ./scripts/sb-exec.sh <arquivo.sql>
#      ./scripts/sb-exec.sh --validate
#      ./scripts/sb-exec.sh --check-connection
# =============================================================

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env.supabase"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado."
  echo "Copie .env.supabase.example para .env.supabase e preencha as credenciais."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${SUPABASE_URL:?SUPABASE_URL não definido em .env.supabase}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY não definido em .env.supabase}"

# ── Testar conexão ───────────────────────────────────────────
check_connection() {
  echo "[sb-exec] Testando conexão..."
  RESULT=$(curl -sf \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    "${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_SERVICE_ROLE_KEY}" \
    -o /dev/null -w "%{http_code}")
  if [ "$RESULT" = "200" ]; then
    echo "[sb-exec] ✅ Conexão OK (HTTP 200)"
  else
    echo "[sb-exec] ❌ Falha na conexão (HTTP $RESULT)"
    exit 1
  fi
}

# ── Executar SQL via RPC ─────────────────────────────────────
exec_sql() {
  local SQL_FILE="$1"
  if [ ! -f "$SQL_FILE" ]; then
    echo "ERRO: arquivo não encontrado: $SQL_FILE"
    exit 1
  fi

  local SQL
  SQL=$(cat "$SQL_FILE")

  echo "[sb-exec] Executando: $SQL_FILE"

  RESPONSE=$(curl -sf \
    -X POST \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"query\": $(echo "$SQL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}" \
    "${SUPABASE_URL}/rest/v1/rpc/exec_sql" 2>&1) || true

  echo "$RESPONSE"
}

# ── Validar policies DELETE da migration 013 ─────────────────
validate_013() {
  echo "[sb-exec] Validando policies DELETE (migration 013)..."

  QUERY='SELECT tablename, policyname, cmd FROM pg_policies WHERE cmd = '"'"'DELETE'"'"' AND tablename IN ('"'"'usuarios'"'"','"'"'empresas'"'"','"'"'usuario_empresas'"'"','"'"'configuracoes'"'"','"'"'colaboradores'"'"','"'"'boletins'"'"','"'"'rh_documentos'"'"','"'"'rh_saude'"'"','"'"'rh_epis'"'"','"'"'rh_despesas'"'"','"'"'apontamentos_historico'"'"') ORDER BY tablename;'

  curl -sf \
    -G \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Accept: application/json" \
    --data-urlencode "select=tablename,policyname,cmd" \
    "${SUPABASE_URL}/rest/v1/pg_policies?cmd=eq.DELETE"
}

# ── Dispatch ─────────────────────────────────────────────────
case "${1:-}" in
  --check-connection) check_connection ;;
  --validate)         validate_013 ;;
  "")
    echo "Uso: $0 <arquivo.sql> | --check-connection | --validate"
    exit 1
    ;;
  *)                  exec_sql "$1" ;;
esac
