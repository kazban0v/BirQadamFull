#!/bin/bash

# ── Настройки ──────────────────────────────────────────
export TZ="Asia/Almaty"
TELEGRAM_TOKEN="8363721957:AAHwM7g-AEM_cLj4LRslvITVLmaaBpDDqgc"
TELEGRAM_CHAT_ID="-1003216386295"
PROJECT_NAME="Remo"
REPORT_DIR="/tmp/trivy-reports"
HISTORY_DIR="/opt/sca-report/history"
DATE=$(date '+%Y-%m-%d %H:%M')
DATE_SHORT=$(date '+%Y-%m-%d')
mkdir -p "$REPORT_DIR" "$HISTORY_DIR/$DATE_SHORT"

IMAGES=(
  "remo-web-remo-web:latest:Remo Web App"
  "grafana/grafana:latest:Grafana"
  "grafana/loki:2.9.8:Loki"
  "prom/prometheus:latest:Prometheus"
  "prom/alertmanager:latest:Alertmanager"
  "grafana/promtail:latest:Promtail"
  "prom/blackbox-exporter:latest:Blackbox Exporter"
  "gcr.io/cadvisor/cadvisor:latest:cAdvisor"
)

send_telegram() {
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_CHAT_ID}" \
    -d parse_mode="HTML" \
    -d text="$1" > /dev/null
}

TOTAL_CRITICAL=0
TOTAL_HIGH=0
TOTAL_NEW=0

# Начинаем собирать одно большое сообщение
MESSAGE="🔍 <b>SCA Report — ${PROJECT_NAME}</b>
📅 ${DATE}
━━━━━━━━━━━━━━━━━━━━━━
"

# ── Сканирование ───────────────────────────────────────
for IMAGE_ENTRY in "${IMAGES[@]}"; do
  IMAGE_NAME=$(echo "$IMAGE_ENTRY" | cut -d: -f1-2)
  IMAGE_LABEL=$(echo "$IMAGE_ENTRY" | cut -d: -f3)
  SAFE_NAME=$(echo "$IMAGE_LABEL" | tr ' ' '_')
  REPORT_FILE="${REPORT_DIR}/${SAFE_NAME}.json"
  PREV_REPORT="${HISTORY_DIR}/$(date -d 'yesterday' '+%Y-%m-%d')/${SAFE_NAME}.json"

  trivy image "$IMAGE_NAME" \
    --format json \
    --output "$REPORT_FILE" \
    --scanners vuln \
    --quiet 2>/dev/null

  CRITICAL=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' "$REPORT_FILE" 2>/dev/null || echo 0)
  HIGH=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="HIGH")] | length' "$REPORT_FILE" 2>/dev/null || echo 0)
  MEDIUM=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="MEDIUM")] | length' "$REPORT_FILE" 2>/dev/null || echo 0)
  LOW=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="LOW")] | length' "$REPORT_FILE" 2>/dev/null || echo 0)

  TOTAL_CRITICAL=$((TOTAL_CRITICAL + CRITICAL))
  TOTAL_HIGH=$((TOTAL_HIGH + HIGH))

  # Diff с вчера
  NEW_COUNT=0
  if [ -f "$PREV_REPORT" ]; then
    NEW_COUNT=$(jq -r --slurpfile prev "$PREV_REPORT" '
      [.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL" or .Severity=="HIGH")]
      | map(select(.VulnerabilityID as $id |
          [$prev[0].Results[]?.Vulnerabilities[]?.VulnerabilityID] | index($id) | not))
      | length
    ' "$REPORT_FILE" 2>/dev/null || echo 0)
    TOTAL_NEW=$((TOTAL_NEW + NEW_COUNT))
  fi

  # Статус эмодзи
  if [ "$CRITICAL" -gt 0 ]; then STATUS="🔴"
  elif [ "$HIGH" -gt 0 ]; then STATUS="🟠"
  elif [ "$MEDIUM" -gt 0 ]; then STATUS="🟡"
  else STATUS="🟢"; fi

  NEW_BADGE=""
  [ "$NEW_COUNT" -gt 0 ] && NEW_BADGE=" 🆕+${NEW_COUNT}"

  MESSAGE="${MESSAGE}${STATUS} <b>${IMAGE_LABEL}</b>${NEW_BADGE}
  🔴 ${CRITICAL}  🟠 ${HIGH}  🟡 ${MEDIUM}  ⚪ ${LOW}
"

  cp "$REPORT_FILE" "${HISTORY_DIR}/${DATE_SHORT}/${SAFE_NAME}.json"
done

# ── Итог ───────────────────────────────────────────────
MESSAGE="${MESSAGE}━━━━━━━━━━━━━━━━━━━━━━"

if [ "$TOTAL_CRITICAL" -gt 0 ]; then
  MESSAGE="${MESSAGE}
🚨 <b>СРОЧНО — Critical: ${TOTAL_CRITICAL}</b>"
elif [ "$TOTAL_HIGH" -gt 5 ]; then
  MESSAGE="${MESSAGE}
⚠️ <b>High: ${TOTAL_HIGH} — нужно ревью</b>"
else
  MESSAGE="${MESSAGE}
✅ <b>Всё под контролем</b>"
fi

[ "$TOTAL_NEW" -gt 0 ] && MESSAGE="${MESSAGE}
🆕 Новых за сутки: <b>${TOTAL_NEW}</b>"

send_telegram "$MESSAGE"