#!/bin/bash
# repo 落地入口：委派既有 Herdr land，在主 worktree 整合；不在這裡執行 check 或部署。
# release 必填針對性 check，完整檢查留給 npm run deploy；非 release 固定完整 check。
set -euo pipefail

usage() {
  echo '用法：bash scripts/land.sh <branch> <issue 或 -> <comment> [--check <針對性命令>] [--release] [--dry-run]'
  echo 'release 必須明確指定 --check；非 release 不接受 --check，固定 npm run check。'
}
fail() { echo "錯誤：$*" >&2; exit 1; }

if [ "$#" -eq 1 ] && [ "$1" = --help ]; then usage; exit 0; fi
[ "$#" -ge 3 ] || { usage >&2; exit 1; }
branch=$1 issue=$2 comment=$3
shift 3
[[ -n "${branch//[[:space:]]/}" && "$branch" != -* ]] || fail 'branch 不可空白或以 - 開頭'
[[ "$issue" = - || "$issue" =~ ^[0-9]+$ ]] || fail 'issue 必須是票號或 -'
[[ -n "${comment//[[:space:]]/}" && "$comment" != --* ]] || fail 'comment 不可空白或以 -- 開頭'

check='' release=0 dry=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --check)
      [ -z "$check" ] || fail '重複 --check'
      [ "$#" -ge 2 ] || fail '--check 缺少命令'
      [[ -n "${2//[[:space:]]/}" && "$2" != --* ]] || fail '--check 缺少命令'
      check=$2; shift 2 ;;
    --release)
      [ "$release" -eq 0 ] || fail '重複 --release'
      release=1; shift ;;
    --dry-run)
      [ "$dry" -eq 0 ] || fail '重複 --dry-run'
      dry=1; shift ;;
    *) fail "不認得的參數：$1" ;;
  esac
done

if [ "$release" -eq 1 ]; then
  [ -n "$check" ] || fail 'release 必須明確指定 --check <針對性命令>'
else
  [ -z "$check" ] || fail '非 release 不接受 --check，固定 npm run check'
  check='npm run check'
fi

land_script=${HERDR_LAND_SCRIPT:-${HOME:?找不到 HOME，請設定 HERDR_LAND_SCRIPT}/.codex/skills/herdr-dispatch/scripts/land.sh}
[ -f "$land_script" ] && [ -r "$land_script" ] || fail "找不到或無法讀取 land 腳本：${land_script}（可用 HERDR_LAND_SCRIPT 指定）"
common_dir=$(git rev-parse --path-format=absolute --git-common-dir) || fail '目前目錄不在 Git repo'
repo=$(dirname "$common_dir")
args=("$branch" "$issue" "$comment" --repo "$repo" --check "$check")
if [ "$release" -eq 1 ]; then args+=(--release 'npm run deploy'); fi
if [ "$dry" -eq 1 ]; then args+=(--dry-run); fi
exec bash "$land_script" "${args[@]}"
