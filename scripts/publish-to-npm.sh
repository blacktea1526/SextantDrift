#!/usr/bin/env bash

# ==============================================================================
# SextantDrift — npm / npx 一键自动化发布脚本 (Publishing to npm Registry)
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo -e "\033[36m┌─────────────────────────────────────────────────────────────┐\033[0m"
echo -e "\033[36m│\033[0m \033[1m\033[32mSextantDrift\033[0m — 一键自动化发布至 npm / npx 镜像服务        \033[36m│\033[0m"
echo -e "\033[36m└─────────────────────────────────────────────────────────────┘\033[0m"

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

echo ""
echo "==> [1/3] 正在发布核心引擎包: @sextant/core 到 npm..."
(cd packages/core && "$PNPM_BIN" publish --access public --no-git-checks)

echo ""
echo "==> [2/3] 正在发布离线双图可视化报告包: @sextant/web-report 到 npm..."
(cd packages/web-report && "$PNPM_BIN" publish --access public --no-git-checks)

echo ""
echo "==> [3/3] 正在发布 CLI 门禁工具包: sextant-drift 到 npm..."
(cd packages/cli && "$PNPM_BIN" publish --access public --no-git-checks)

echo ""
echo -e "\033[32m✔ 恭喜！SextantDrift 已成功发布到 npm 镜像！\033[0m"
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
