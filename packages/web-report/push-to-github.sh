#!/usr/bin/env bash

# ==============================================================================
# 将 standalone/sextant-web-report 推送到独立 GitHub 私有仓库
# ==============================================================================

set -e

REPO_NAME="sextant-web-report"
GITHUB_USER="blacktea1526"
REMOTE_URL="git@github.com:${GITHUB_USER}/${REPO_NAME}.git"
REMOTE_HTTPS="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "==> 检查 Git 仓库初始化状态..."
if [ ! -d ".git" ]; then
  git init
  git branch -M main
fi

git add .
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  git commit -m "feat: initial commit for standalone @sextant/web-report"
fi

echo "==> 准备推送到 GitHub 私有仓库: ${GITHUB_USER}/${REPO_NAME}..."

# 如果安装并登录了 gh CLI，则尝试自动创建私有仓库
if command -v gh &> /dev/null && gh auth status &> /dev/null; then
  echo "==> 正在使用 GitHub CLI 创建私有仓库 (若已存在则忽略)..."
  gh repo create "${GITHUB_USER}/${REPO_NAME}" --private --source=. --remote=origin --push || true
else
  echo "==> 配置远程仓库地址: ${REMOTE_URL} (或使用 HTTPS: ${REMOTE_HTTPS})"
  git remote remove origin 2>/dev/null || true
  git remote add origin "$REMOTE_URL"
  echo ""
  echo "请在 GitHub 上创建名为 '${REPO_NAME}' 的私有仓库 (Private Repository)，然后执行以下命令推送："
  echo "  cd $DIR"
  echo "  git push -u origin main"
  echo ""
  echo "后续在 GitHub 仓库设置中 (Settings -> Change repository visibility) 可以一键转为公开 (Public)。"
fi
