#!/usr/bin/env bash
# Build on `develop`, then release to `main`.
# The build goes to /docs, which GitHub Pages serves from the `main` branch.
# Must be run from the `develop` branch.
#
# Usage: scripts/deploy.sh [patch|minor|major]   (default: patch)
# Bumps the version in package.json, commits it, tags vX.Y.Z and releases.
set -euo pipefail

BUMP=${1:-patch}
case "$BUMP" in
  patch|minor|major) ;;
  *) echo "✗ ใช้: deploy.sh [patch|minor|major] (ได้รับ '$BUMP')" >&2; exit 1 ;;
esac

SOURCE_BRANCH=develop
DEPLOY_BRANCH=main
REMOTE=origin

cd "$(git rev-parse --show-toplevel)"

current=$(git rev-parse --abbrev-ref HEAD)
if [ "$current" != "$SOURCE_BRANCH" ]; then
  echo "✗ ต้องรันจาก branch '$SOURCE_BRANCH' (ตอนนี้อยู่ที่ '$current')" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "✗ มีไฟล์ที่ยังไม่ commit กรุณา commit หรือ stash ก่อน" >&2
  exit 1
fi

echo "→ ดึงข้อมูลล่าสุดจาก $REMOTE"
git fetch "$REMOTE"

# local may be ahead of remote (we push it below) but must not be behind or diverged
if git rev-parse --verify -q "$REMOTE/$SOURCE_BRANCH" >/dev/null &&
   ! git merge-base --is-ancestor "$REMOTE/$SOURCE_BRANCH" HEAD; then
  echo "✗ $SOURCE_BRANCH ตามหลังหรือแยกจาก $REMOTE/$SOURCE_BRANCH กรุณา pull/rebase ก่อน" >&2
  exit 1
fi

# The push relay (worker/) is deployed separately by scripts/deploy-worker.sh, never by this script.
# Say so when the app and the Worker may be out of step (informational, never blocks a release).
PUSH_CONFIG=${PUSH_CONFIG_FILE:-src/lib/pushConfig.ts}
if grep -qE "^export const PUSH_SERVER_URL = ''" "$PUSH_CONFIG"; then
  echo "ℹ Push ยังไม่ถูกตั้งค่า (pushConfig.ts ว่าง) แอปรุ่นนี้จะซ่อนปุ่ม Push เปิดใช้โดย  npm run deploy:worker -- --write-config  แล้วคอมมิต"
else
  last=$(git describe --tags --abbrev=0 2>/dev/null || true)
  if [ -n "$last" ] && ! git diff --quiet "$last" -- worker; then
    echo "ℹ worker/ เปลี่ยนไปจาก $last แต่สคริปต์นี้ไม่ได้ deploy Worker ให้ ถ้าต้องการ รัน  npm run deploy:worker"
  fi
fi

echo "→ ติดตั้ง dependencies และ test"
npm ci
npm test

echo "→ อัปเดต version ($BUMP)"
npm version "$BUMP" --no-git-tag-version >/dev/null
VERSION=$(node -p "require('./package.json').version")
if git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  git checkout -- package.json package-lock.json
  echo "✗ tag v$VERSION มีอยู่แล้ว" >&2
  exit 1
fi

echo "→ build v$VERSION"
if ! npm run build; then
  git checkout -- package.json package-lock.json
  exit 1
fi
git add package.json package-lock.json docs
git commit -q -m "chore: release v$VERSION"
git tag "v$VERSION"

echo "→ merge $SOURCE_BRANCH เข้า $DEPLOY_BRANCH"
git checkout "$DEPLOY_BRANCH"
# always go back to develop, even if the merge/push fails
trap 'git checkout "$SOURCE_BRANCH" >/dev/null 2>&1 || true' EXIT
git merge --ff-only "$REMOTE/$DEPLOY_BRANCH" 2>/dev/null || true
git merge --no-ff "$SOURCE_BRANCH" -m "Release: merge $SOURCE_BRANCH into $DEPLOY_BRANCH"

echo "→ push $SOURCE_BRANCH, $DEPLOY_BRANCH และ tag v$VERSION (GitHub Pages จะอัปเดตเองจาก main:/docs)"
git push "$REMOTE" "$SOURCE_BRANCH" "$DEPLOY_BRANCH" "v$VERSION"

echo "✓ deploy v$VERSION เสร็จแล้ว รอ Pages อัปเดตสักครู่ (ดูที่ Settings → Pages)"
