#!/usr/bin/env bash
# Deploy the push-relay Worker (worker/) to Cloudflare. This is separate from `npm run deploy`,
# which only publishes the app to GitHub Pages and never touches the Worker.
#
# Usage: scripts/deploy-worker.sh [--dry-run] [--write-config]
#   --dry-run       run every local check and bundle the Worker, but do not deploy (no login needed)
#   --write-config  after deploying, write the Worker URL and VAPID public key into
#                   src/lib/pushConfig.ts (you still commit and deploy the app yourself)
#
# First time? Do steps 1-3 of worker/README.md (KV id, VAPID key, secrets) and then run this.
# Env overrides (used by tests): WRANGLER (default "npx wrangler"), PUSH_CONFIG_FILE.
set -euo pipefail

WRANGLER=${WRANGLER:-npx wrangler}
CONFIG_FILE=${PUSH_CONFIG_FILE:-src/lib/pushConfig.ts}
DRY=0
WRITE=0

say() { printf '→ %s\n' "$*"; }
warn() { printf '! %s\n' "$*" >&2; }
fail() { printf '✗ %s\n' "$*" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --write-config) WRITE=1 ;;
    -h | --help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) fail "ไม่รู้จักตัวเลือก '$arg' (ใช้ --dry-run หรือ --write-config)" ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
TOML=worker/wrangler.toml

# ---- 1. config sanity (cheap, local) ---------------------------------------------------------
grep -q 'REPLACE_WITH' "$TOML" && fail "$TOML ยังมีค่า REPLACE_WITH_… ใส่ id ของ KV namespace ก่อน (worker/README.md ข้อ 1)"
grep -qE '^id = "[0-9a-f]{32}"' "$TOML" || fail "ไม่พบ KV namespace id (32 ตัวอักษร) ใน $TOML"
if grep -qE '^(VAPID_SUBJECT|VAPID_PRIVATE_JWK)[[:space:]]*=' "$TOML"; then
  fail "VAPID_SUBJECT / VAPID_PRIVATE_JWK ต้องเป็น secret (npx wrangler secret put …) ห้ามอยู่ใน $TOML เพราะ repo เป็นสาธารณะ"
fi

# ---- 2. dependencies, tests, typecheck -------------------------------------------------------
if [ ! -x worker/node_modules/.bin/wrangler ] && [ "$WRANGLER" = "npx wrangler" ]; then
  say "ติดตั้ง dependencies ของ worker (ครั้งแรก)"
  (cd worker && npm install --no-audit --no-fund)
fi

say "ทดสอบ Worker"
npx vitest run worker
say "ตรวจชนิดข้อมูล"
(cd worker && npx tsc -p .)

# ---- 3. dry run: bundle only -----------------------------------------------------------------
if [ "$DRY" = 1 ]; then
  OUT=$(mktemp -d)
  say "dry-run: บันเดิล Worker (ไม่ deploy)"
  (cd worker && $WRANGLER deploy --dry-run --outdir "$OUT") >/dev/null
  echo "✓ dry-run ผ่าน: บันเดิลได้ $(ls "$OUT" | wc -l | tr -d ' ') ไฟล์ (ยังไม่ได้ deploy)"
  rm -rf "$OUT"
  exit 0
fi

# ---- 4. login and secrets --------------------------------------------------------------------
say "ตรวจการล็อกอิน Cloudflare"
(cd worker && $WRANGLER whoami) >/dev/null 2>&1 || fail "ยังไม่ได้ล็อกอิน Cloudflare: รัน  cd worker && npx wrangler login"

SECRETS=$(cd worker && $WRANGLER secret list 2>/dev/null || true)
if [ -n "$SECRETS" ]; then
  MISSING=""
  for name in VAPID_PRIVATE_JWK VAPID_SUBJECT; do
    printf '%s' "$SECRETS" | grep -q "$name" || MISSING="$MISSING $name"
  done
  if [ -n "$MISSING" ]; then
    printf '✗ ยังไม่ได้ตั้ง secret:%s\n' "$MISSING" >&2
    for name in $MISSING; do echo "    cd worker && npx wrangler secret put $name" >&2; done
    exit 1
  fi
else
  warn "ตรวจ secret ไม่ได้ (Worker อาจยังไม่เคย deploy) จะตรวจจาก /health หลัง deploy แทน"
fi

# ---- 5. deploy -------------------------------------------------------------------------------
say "deploy Worker (commit $(git rev-parse --short HEAD)$(git diff --quiet -- worker || echo ' + การแก้ใน worker/ ที่ยังไม่คอมมิต'))"
LOG=$(mktemp)
(cd worker && $WRANGLER deploy) 2>&1 | tee "$LOG"
URL=$(grep -oE 'https://[A-Za-z0-9.-]+\.workers\.dev' "$LOG" | head -1 || true)
rm -f "$LOG"
[ -n "$URL" ] || fail "deploy สำเร็จแต่หา URL .workers.dev ในผลลัพธ์ไม่เจอ (ใช้โดเมนอื่น?) ตรวจ /health เอง แล้วใส่ URL ใน $CONFIG_FILE"

# ---- 6. health check (also tells us the public key that matches the deployed secret) ---------
say "ตรวจ $URL/health"
STATUS=bad; PUBKEY=""; ERR="ไม่มีการตอบกลับ"
for attempt in 1 2 3 4 5; do
  if BODY=$(curl -fsS --max-time 20 "$URL/health" 2>/dev/null || curl -sS --max-time 20 "$URL/health" 2>/dev/null); then
    PARSED=$(printf '%s' "$BODY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log([j.ok===true?"ok":"bad",j.publicKey||"",j.error||""].join("|"))}catch{console.log("bad||ตอบกลับไม่ใช่ JSON")}})')
    IFS='|' read -r STATUS PUBKEY ERR <<<"$PARSED"
    [ "$STATUS" = ok ] && break
    # a 500 with an error text means it is reachable but misconfigured: no point retrying
    [ -n "$ERR" ] && break
  fi
  sleep 3
done
if [ "$STATUS" != ok ]; then
  echo "✗ Worker deploy แล้วแต่ /health ไม่ปกติ: $ERR" >&2
  echo "  (secret ตั้งหลัง deploy ได้ ไม่ต้อง deploy ใหม่: cd worker && npx wrangler secret put VAPID_SUBJECT)" >&2
  exit 1
fi

# ---- 7. compare with the app's config --------------------------------------------------------
current() { sed -n "s/^export const $1 = '\\(.*\\)'.*/\\1/p" "$CONFIG_FILE" 2>/dev/null | head -1; }
setvalue() { # $1 name, $2 value
  sed "s|^export const $1 = '.*'|export const $1 = '$2'|" "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
}
CUR_URL=$(current PUSH_SERVER_URL)
CUR_KEY=$(current VAPID_PUBLIC_KEY)

echo
echo "✓ Worker พร้อมใช้งาน"
echo "  URL         : $URL"
echo "  PUBLIC KEY  : $PUBKEY"
echo

NEEDS_UPDATE=0
[ "$CUR_URL" = "$URL" ] || NEEDS_UPDATE=1
[ "$CUR_KEY" = "$PUBKEY" ] || NEEDS_UPDATE=1

if [ -n "$CUR_KEY" ] && [ "$CUR_KEY" != "$PUBKEY" ]; then
  warn "VAPID_PUBLIC_KEY ใน $CONFIG_FILE ไม่ตรงกับกุญแจที่ Worker ใช้อยู่ ถ้าไม่แก้ push จะถูกปฏิเสธ"
fi

if [ "$NEEDS_UPDATE" = 0 ]; then
  echo "  $CONFIG_FILE ตรงกับ Worker แล้ว ไม่ต้องแก้อะไร"
elif [ "$WRITE" = 1 ]; then
  setvalue PUSH_SERVER_URL "$URL"
  setvalue VAPID_PUBLIC_KEY "$PUBKEY"
  echo "  เขียนค่าลง $CONFIG_FILE แล้ว"
  # the real values change the file's literal types; make sure the app still compiles with them
  say "ตรวจว่าแอปยัง build ผ่านกับค่าใหม่"
  npx tsc -b || fail "แอป build ไม่ผ่านหลังเขียน $CONFIG_FILE (ดู error ด้านบน) ค่านี้ยังอยู่ในไฟล์ แก้แล้วค่อย deploy แอป"
  echo "  คอมมิตไฟล์นี้ แล้ว  npm run deploy  เพื่อปล่อยแอปที่เปิดใช้ Push"
else
  echo "  ใส่ค่าเหล่านี้ใน $CONFIG_FILE (หรือรันซ้ำพร้อม --write-config ให้เขียนให้):"
  echo "    export const PUSH_SERVER_URL = '$URL'"
  echo "    export const VAPID_PUBLIC_KEY = '$PUBKEY'"
  echo "  แล้วคอมมิตและ  npm run deploy  เพื่อปล่อยแอปที่เปิดใช้ Push"
fi
