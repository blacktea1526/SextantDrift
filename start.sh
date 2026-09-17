#!/usr/bin/env bash

# ==============================================================================
# SextantDrift — 架构 X 光机与偏航检测罗盘
# 统一本地工程启动与开发控制脚本 (Startup Controller)
# ==============================================================================

set -e

# 颜色配置
COLOR_RESET="\033[0m"
COLOR_BOLD="\033[1m"
COLOR_GREEN="\033[32m"
COLOR_BLUE="\033[34m"
COLOR_CYAN="\033[36m"
COLOR_YELLOW="\033[33m"
COLOR_RED="\033[31m"
COLOR_GRAY="\033[90m"

# 定位脚本目录与项目根目录
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PNPM_BIN="$DIR/node_modules/.bin/pnpm"
if [ ! -f "$PNPM_BIN" ]; then
  if command -v pnpm &> /dev/null; then
    PNPM_BIN="pnpm"
  else
    PNPM_BIN="npx pnpm"
  fi
fi

print_banner() {
  echo -e "${COLOR_CYAN}┌─────────────────────────────────────────────────────────────┐${COLOR_RESET}"
  echo -e "${COLOR_CYAN}│${COLOR_RESET}  ${COLOR_BOLD}${COLOR_GREEN}SextantDrift (v2.0 Reboot)${COLOR_RESET} — 统一工程开发与启动中枢     ${COLOR_CYAN}│${COLOR_RESET}"
  echo -e "${COLOR_CYAN}│${COLOR_RESET}  ${COLOR_GRAY}Architecture X-Ray & Drift Compass Controller             ${COLOR_CYAN}│${COLOR_RESET}"
  echo -e "${COLOR_CYAN}└─────────────────────────────────────────────────────────────┘${COLOR_RESET}"
}

print_help() {
  print_banner
  echo -e "${COLOR_BOLD}用法 (Usage):${COLOR_RESET}"
  echo -e "  ./start.sh [选项]"
  echo ""
  echo -e "${COLOR_BOLD}可用选项 (Options):${COLOR_RESET}"
  echo -e "  ${COLOR_GREEN}(无参数)${COLOR_RESET}      启动本地可视化审查工作台 (Workbench Web Server @ 3000)"
  echo -e "  ${COLOR_BLUE}--ui${COLOR_RESET}          启动 Vitest UI 交互式测试仪表盘"
  echo -e "  ${COLOR_BLUE}--test${COLOR_RESET}        执行全套单元测试 (Vitest CLI, 15 个套件, 36 个用例)"
  echo -e "  ${COLOR_BLUE}--coverage${COLOR_RESET}    执行单元测试并生成 V8 代码覆盖率报告"
  echo -e "  ${COLOR_BLUE}--bench${COLOR_RESET}       执行核心 AST 与 Tarjan 图算法性能基准压测"
  echo -e "  ${COLOR_BLUE}--build${COLOR_RESET}       全量编译 Monorepo 所有子包 (@sextant/core, @sextant/cli)"
  echo -e "  ${COLOR_BLUE}--check${COLOR_RESET}       执行 Phase 1 架构偏航实测 (跑通 Clean 与 Drifted 双向用例)"
  echo -e "  ${COLOR_BLUE}--help, -h${COLOR_RESET}    查看本帮助信息"
  echo ""
}

check_environment() {
  if ! command -v node &> /dev/null; then
    echo -e "${COLOR_RED}[错误] 未检测到 Node.js，请先安装 Node.js LTS (>= 18.0.0)。${COLOR_RESET}"
    exit 1
  fi

  NODE_VERSION=$(node -v | tr -d 'v')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${COLOR_YELLOW}[警告] 当前 Node.js 版本为 v${NODE_VERSION}，建议使用 Node.js >= 18.0.0。${COLOR_RESET}"
  fi
}

# 解析参数
ACTION="dev"
while [[ $# -gt 0 ]]; do
  case $1 in
    --ui)
      ACTION="ui"
      shift
      ;;
    --test)
      ACTION="test"
      shift
      ;;
    --coverage)
      ACTION="coverage"
      shift
      ;;
    --bench)
      ACTION="bench"
      shift
      ;;
    --build)
      ACTION="build"
      shift
      ;;
    --check)
      ACTION="check"
      shift
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo -e "${COLOR_RED}[未知选项] $1${COLOR_RESET}"
      print_help
      exit 1
      ;;
  esac
done

check_environment

case $ACTION in
  ui)
    print_banner
    echo -e "${COLOR_GREEN}==>${COLOR_RESET} 正在拉起 ${COLOR_BOLD}Vitest UI 交互式测试仪表盘${COLOR_RESET}..."
    npx vitest --ui
    ;;
  test)
    print_banner
    echo -e "${COLOR_GREEN}==>${COLOR_RESET} 正在执行 ${COLOR_BOLD}Vitest 全套单测套件${COLOR_RESET}..."
    npx vitest run
    ;;
  coverage)
    print_banner
    echo -e "${COLOR_GREEN}==>${COLOR_RESET} 正在运行测试并统计 ${COLOR_BOLD}V8 覆盖率${COLOR_RESET}..."
    npx vitest run --coverage
    ;;
  bench)
    print_banner
    echo -e "${COLOR_GREEN}==>${COLOR_RESET} 正在运行 ${COLOR_BOLD}@sextant/core 性能基准基线压测${COLOR_RESET}..."
    $PNPM_BIN --filter @sextant/core bench
    ;;
  build)
    print_banner
    echo -e "${COLOR_GREEN}==>${COLOR_RESET} 正在全量编译 ${COLOR_BOLD}Monorepo 所有子包${COLOR_RESET}..."
    $PNPM_BIN -r run build
    echo -e "${COLOR_GREEN}✓ 编译完成！${COLOR_RESET}"
    ;;
  check)
    print_banner
    if [ ! -f "packages/cli/dist/bin/sextant-drift.js" ]; then
      echo -e "${COLOR_YELLOW}[提示] 未发现 CLI 构建产物，正在自动构建...${COLOR_RESET}"
      $PNPM_BIN -r run build
    fi
    echo -e "${COLOR_GREEN}==>${COLOR_RESET} 正在执行 ${COLOR_BOLD}@sextant/cli 架构门禁实测 (Clean & Drifted 双向核验)${COLOR_RESET}..."
    echo -e "\n${COLOR_CYAN}[1/2] 正在校验合规架构工程 (Clean Layered App)...${COLOR_RESET}"
    node packages/cli/dist/bin/sextant-drift.js check packages/core/tests/fixtures/clean-layered-app
    echo -e "\n${COLOR_CYAN}[2/2] 正在校验偏航架构工程 (Drifted App，预期退出码 1 拦截)...${COLOR_RESET}"
    if node packages/cli/dist/bin/sextant-drift.js check packages/core/tests/fixtures/drifted-bypass-app; then
      echo -e "${COLOR_RED}✖ 错误：违规工程未被拦截！${COLOR_RESET}"
      exit 1
    else
      echo -e "\n${COLOR_GREEN}✔ 成功：@sextant/cli 架构门禁成功阻断偏航工程！${COLOR_RESET}"
    fi
    ;;
  dev)
    print_banner
    # 确保依赖构建就绪
    if [ ! -f "packages/core/dist/index.js" ]; then
      echo -e "${COLOR_YELLOW}[提示] 未发现 packages/core/dist 构建产物，正在自动预构建...${COLOR_RESET}"
      $PNPM_BIN -r run build
    fi
    echo -e "${COLOR_GREEN}==>${COLOR_RESET} 正在启动 ${COLOR_BOLD}SextantDrift 本地可视化审阅工作台${COLOR_RESET}..."
    node scripts/dev-server.mjs
    ;;
esac
