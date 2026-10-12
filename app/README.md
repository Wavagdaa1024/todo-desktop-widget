# AI Task Board — 桌面任务工作台

专为并行管理复杂工程任务（如联合仿真、机械臂控制、实验报告等）与 AI（Gemini / Codex）协同打造的 Windows 桌面卡片 Todo。

## 🌟 第一阶段功能特性

- **多层级递归任务树**：支持 3 层及以上无限制任务嵌套，严格按照叶子任务精确计算项目完成率（如 `3/6 · 50%`）。
- **人机边界分离**：AI 任务状态分为 `AI 执行中`、`等待我验收` 与 `已完成`；提交成果不擅自勾选任务，验收权始终归用户。
- **高可靠本地离线存储**：
  - 数据文件存放于 Windows `userData` 独立目录，100% 离线可用，零网络依赖。
  - 原子替换写入（`.tmp` 写入后原子重命名），防断电与崩溃损坏。
  - 自动保留最近 5 份轮转备份（`backup.1~5.json`），支持损坏自愈与一键恢复。
  - 完整支持全量 JSON 导出与校验导入。
- **Windows 原生集成**：
  - 系统托盘驻留，点击关闭 `×` 默认隐藏到托盘，后台持续运行。
  - 单实例锁：防止重复启动产生数据冲突。
  - 任务超时巡检提醒：AI 任务等待超 30 分钟推送桌面通知。
  - 开机自启与窗口始终置顶。
- **现代化交互体验**：
  - 中文拼音输入法（IME）选字防误触。
  - 全局快捷键：`Ctrl+N` 新增卡片、`Ctrl+F` 搜索、`Esc` 退出编辑。
  - 浅色 / 深色 / 跟随系统主题一键切换。
  - 一键复制结构化任务提示词，直接粘贴给 Gemini / Codex。

---

## 🚀 开发与构建命令

```bash
# 进入核心代码目录
cd app

# 安装依赖
npm install

# 启动开发调试
npm run dev

# 运行 TypeScript 类型检查
npm run typecheck

# 运行 Vitest 单元测试
npm test

# 构建生产产物
npm run build

# 生成 Windows x64 NSIS 安装包
npm run dist:win
```

---

## 📂 项目目录结构

```text
todo/
├── plan.md                 # 完整产品需求书 v2.0
├── README.md               # 根说明文档
└── app/                    # 桌面端完整源码
    ├── src/
    │   ├── main/           # 窗口、托盘、原子存储引擎、超时巡检
    │   ├── preload/        # 受限 contextBridge 安全桥接 API
    │   └── renderer/       # React 18 UI 组件与领域计算逻辑
    │       ├── components/ # Header, TaskCard, TaskTree, AiWorkPanel, SettingsModal
    │       ├── domain/     # 递归树纯函数、完成率计算、逾期判断、类型规范
    │       └── styles/
    ├── resources/          # 高分辨率 ICO 与 PNG 图标
    ├── tests/              # Vitest 单元与存储测试套件
    ├── docs/               # S1-01 ~ S1-30 验收测试清单
    ├── AGENTS.md           # AI 协作规范
    └── KNOWN_ISSUES.md     # 已知问题说明
```
