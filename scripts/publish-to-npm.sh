#!/usr/bin/env bash

# ==============================================================================
# SextantDrift — npm / npx 一键自动化发布脚本 (Publishing to npm Registry)
# ==============================================================================
#
# Modes:
#   Default: publish CLI + all @sextant/* packages; fail non-zero if any scoped
#            package publish fails (after CLI has already been published).
#   CLI_ONLY=1 or --cli-only: treat @sextant/* failures as warnings; exit 0 if
#            sextant-drift CLI published successfully.
#
# Dirty tree:
#   Refuses a dirty git working tree unless ALLOW_DIRTY=1 or --allow-dirty.
#   When allowed, warns loudly and passes --no-git-checks to pnpm publish.
#
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

CLI_ONLY="${CLI_ONLY:-0}"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"

for arg in "$@"; do
  case "$arg" in
    --cli-only) CLI_ONLY=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
  esac
done

echo -e "\033[36m┌─────────────────────────────────────────────────────────────┐\033[0m"
echo -e "\033[36m│\033[0m \033[1m\033[32mSextantDrift\033[0m — 一键自动化发布至 npm / npx 镜像服务        \033[36m│\033[0m"
echo -e "\033[36m└─────────────────────────────────────────────────────────────┘\033[0m"

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  if [ "$ALLOW_DIRTY" != "1" ]; then
    echo ""
    echo -e "\033[31m✖ 工作区存在未提交变更，已拒绝发布。\033[0m"
    echo "  请先提交或 stash，或显式设置 ALLOW_DIRTY=1 / 传入 --allow-dirty 后重试。"
    echo ""
    git status --short
    exit 1
  fi
  echo ""
  echo -e "\033[33m⚠ WARNING: 脏工作区发布 (ALLOW_DIRTY=1) — pnpm 将使用 --no-git-checks。\033[0m"
  echo -e "\033[33m  请确认这是有意为之，否则先清理 git 状态再发布。\033[0m"
  echo ""
fi

GIT_CHECK_ARGS=()
if [ "$ALLOW_DIRTY" = "1" ]; then
  GIT_CHECK_ARGS+=(--no-git-checks)
fi

echo "==> 正在检查 npm 登录凭证..."
if ! npm whoami 2>/dev/null; then
  echo ""
  echo -e "\033[33m[提示] 当前尚未登录 npm 账号。\033[0m"
  echo "请先在终端中执行登录授权命令："
  echo ""
  echo "    npm login"
  echo ""
  echo "在浏览器或控制台中完成身份与 2FA 验证后，重新运行本脚本即可自动完成发布。"
  exit 1
fi

NPM_USER=$(npm whoami)
echo -e "\033[32m✔ 检测到 npm 登录账号: \033[1m${NPM_USER}\033[0m"

if [ "$CLI_ONLY" = "1" ]; then
  echo -e "\033[33m[模式] CLI_ONLY=1 — @sextant/* 发布失败将仅警告，不影响退出码。\033[0m"
fi

echo ""
echo "==> 正在执行发布前全量子包编译与门禁自检..."
./start.sh --build
./start.sh --test
./start.sh --check

PNPM_BIN="$DIR/node_modules/.bin/pnpm"
if [ ! -f "$PNPM_BIN" ]; then
  if command -v pnpm &> /dev/null; then
    PNPM_BIN="pnpm"
  else
    PNPM_BIN="npx pnpm"
  fi
fi

publish_pkg() {
  local pkg_dir="$1"
  (cd "$pkg_dir" && "$PNPM_BIN" publish --access public "${GIT_CHECK_ARGS[@]}" --registry=https://registry.npmjs.org/)
}

echo ""
echo "==> [1/4] 正在发布 CLI 门禁主包: sextant-drift 到 npm (支持 npx 免安装运行)..."
publish_pkg packages/cli
echo -e "\033[32m✔ sextant-drift 发布成功！\033[0m"

SCOPED_FAILED=0

echo ""
echo "==> [2/4] 尝试发布核心引擎包: @sextant/core 到 npm..."
if publish_pkg packages/core; then
  echo -e "\033[32m✔ @sextant/core 发布成功！\033[0m"
else
  SCOPED_FAILED=1
  echo -e "\033[33m[提示] @sextant/core 发布失败（作用域可能未开通或已被占用）。\033[0m"
fi

echo ""
echo "==> [3/4] 尝试发布报告扩展包: @sextant/web-report 到 npm..."
if publish_pkg packages/web-report; then
  echo -e "\033[32m✔ @sextant/web-report 发布成功！\033[0m"
else
  SCOPED_FAILED=1
  echo -e "\033[33m[提示] @sextant/web-report 发布失败/跳过。\033[0m"
fi

echo ""
echo "==> [4/4] 尝试发布 MCP 服务端包: @sextant/mcp-server 到 npm..."
if publish_pkg packages/mcp-server; then
  echo -e "\033[32m✔ @sextant/mcp-server 发布成功！\033[0m"
else
  SCOPED_FAILED=1
  echo -e "\033[33m[提示] @sextant/mcp-server 发布失败/跳过。\033[0m"
fi

echo ""
if [ "$SCOPED_FAILED" -ne 0 ]; then
  if [ "$CLI_ONLY" = "1" ]; then
    echo -e "\033[33m⚠ CLI 已发布成功，但部分 @sextant/* 作用域包发布失败（CLI_ONLY 模式，退出 0）。\033[0m"
  else
    echo -e "\033[31m✖ CLI 已发布，但一个或多个 @sextant/* 包发布失败。\033[0m"
    echo "  若仅需 CLI 成功即可，请使用 CLI_ONLY=1 或 --cli-only 重新运行。"
    exit 1
  fi
else
  echo -e "\033[32m✔ 恭喜！SextantDrift 全部目标包已成功发布到 npm！\033[0m"
fi

echo ""
echo "现在全球开发者无需克隆仓库，可直接运行："
echo "    npx sextant-drift"
echo "    npx sextant-drift check"
echo "    npx sextant-drift init"
echo ""
echo "在项目中作为开发依赖安装："
echo "    npm install -D sextant-drift"
echo "    pnpm add -D sextant-drift"
echo ""
