# AI Task Board — 第一阶段验收测试记录 (Stage 1 Acceptance Record)

> 依照 `plan.md` 第 9 章规定，记录 S1-01 至 S1-30 所有用例的验证方式与结果。

| ID | 用户动作 / 测试场景 | 必须看到的结果 | 验证方式 | 状态 | 日期与结果 |
|---|---|---|---|---|---|
| S1-01 | 第一次启动 | 空白但可操作的主界面，可新增第一张卡片，无假进度 | 源码分析 & 界面构建 | **待 Windows 实机验收** | 首次启动 `tasks.json` 初始化为空数组，呈现优雅空状态提示与「+ 新建卡片」入口，完成率无虚假数据 |
| S1-01b | 托盘单击呼出悬浮面板（图1） | 屏幕右下角弹出 Win11 磨砂玻璃小窗，清晰展示 Hero 重点任务、2~3条次级任务与底部「查看全部」 | 组件渲染与主进程联动 | **待 Windows 实机验收** | 成功实现 `WidgetView.tsx`，还原磨砂玻璃质感、Hero 重点任务卡片与 2~3 个次级简化条目，支持双窗口事件驱动同步 |
| S1-02 | 连续创建 10 张卡片 | 所有卡片都有独立标题、状态、进度，不混数据 | 单元测试 & 状态逻辑 | **待 Windows 实机验收** | 基于稳定 ID 隔离，每张卡片维护独立状态、任务树与历史记录 |
| S1-03 | 修改卡片标题、描述、截止日期 | 界面立即变化，退出重开后仍在 | 存储持久化测试 | **待 Windows 实机验收** | 行内即时编辑防抖落盘，保存到 `app.getPath('userData')/tasks_data.json`，支持详情编辑抽屉与日历选择 |
| S1-04 | 卡片折叠/展开、重启 | 标题、进度仍显示；折叠状态恢复，任务未改变 | UI 组件 & 属性持久化 | **待 Windows 实机验收** | `card.collapsed` 字段持久化，折叠时保留标题、状态徽章、进度条与负责人信息 |
| S1-05 | 使用拖拽手柄交换两张卡片位置 | 排序正确，重启后不复原 | Vitest 单元测试 (P1-01) | **自动化测试通过** | `reorderCards` 单元测试通过；基于稳定 `card.id` 重算 `order`，卡片头部增加 GripVertical 手柄 |
| S1-06 | 单张卡片增加 3 层嵌套 | 层级显示正确，每层可增删改、可折叠 | Vitest 单元测试 (`tests/domain.test.ts`) | **自动化测试通过** | 数据模型使用纯递归 `children: TaskItem[]`，不硬编码层级限制，实测 3 层以上递归树逻辑通过 |
| S1-07 | 6 个叶子任务勾选 3 个 | `3/6 · 50%`，父节点三态正确 | Vitest 单元测试 (`tests/domain.test.ts`) | **自动化测试通过** | 精确匹配 `plan.md` 2.2 节 FMU+MuJoCo 案例，父节点正确显示 checked / indeterminate / unchecked |
| S1-08 | 取消其中一个勾选 | 变为 `2/6 · 33%`，没有虚假完成 | Vitest 单元测试 (`tests/domain.test.ts`) | **自动化测试通过** | 勾选取消后完成率即时计算为 33%，且卡片已完成状态通过 `reconcileCardStatus` 自动回退 |
| S1-09 | 点击父任务勾选/取消 | 所有子孙叶子状态统一，百分比正确，支持撤销 | Vitest 单元测试 (`tests/domain.test.ts`) | **自动化测试通过** | 父节点批量反选/全选通过 Vitest 校验，提供即时状态快照与 Undo 支持 |
| S1-10 | 对已完成叶子新增子任务，再删除最后一个子任务 | 进度变动遵循明确规则，不丢完成状态 | Vitest 单元测试 (`tests/domain.test.ts`) | **自动化测试通过** | 新建子任务继承原节点完成状态（规则 6），删除子节点自动推导恢复（规则 7）测试通过 |
| S1-11 | 重命名、删除任务（含有子任务的父任务） | 确认后正确删除，不残留孤儿节点，撤销/恢复可用 | UI 交互 & Undo 逻辑 | **待 Windows 实机验收** | 父任务删除增加二次确认拦截，删除后触发轻量 Undo Toast 气泡 |
| S1-12 | 搜索某个子任务并筛选“待验收” | 仅出现符合两种条件的卡片，清除筛选恢复完整列表 | 检索过滤逻辑 (Header.tsx) | **待 Windows 实机验收** | 搜索词与状态筛选采用交集过滤，修复“待处理”与“待开始”计数不一致问题 (P2-03) |
| S1-13 | 设置昨天到期、今天到期、明天到期 | 分别显示“逾期/今天/未到期”；已完成的不误标 | Vitest 单元测试 (`tests/domain.test.ts`) | **自动化测试通过** | 基于本地日历日期（`YYYY-MM-DD`）跨时区安全比对，已完成任务不标逾期 |
| S1-14 | 将卡片设为 Gemini 执行中 | 开始记录人工登记的等待时间，可编辑正在处理的事 | 状态机与倒计时 | **待 Windows 实机验收** | 记录 `activeStartTime`，界面显示「已等待 X 分钟」并支持手动重启轮次 |
| S1-15 | 状态改为等待我验收 | 子任务不自动勾选；顶部待验收计数变化 | 权限隔离测试 | **待 Windows 实机验收** | 严格贯彻人机边界：设为待验收绝不自动勾选叶子任务，顶部「等待我验收」数字联动更新 |
| S1-16 | 记录两次工作进展 | 两条历史均存在，新记录不覆盖旧记录 | 进度日志存储 | **待 Windows 实机验收** | 历史追加数组 `aiWork.history`，支持查看来源、摘要、改动文件、测试结果与下一步 |
| S1-17 | 复制任务说明 | 可以在记事本中粘贴完整的纯文本任务摘要 | 剪贴板集成 | **待 Windows 实机验收** | 一键将结构化 Markdown 任务树与当前阻塞复制到剪贴板，带复制成功提示 |
| S1-18 | Ctrl+N / Ctrl+F / Esc | 分别新增卡片、搜索、退出弹窗/取消编辑 | 键盘事件监听 | **待 Windows 实机验收** | 快捷键全局绑定与捕获，Esc 退出弹窗与行内编辑 |
| S1-19 | 中文拼音输入并按 Enter 选字 | 不会误保存空任务或重复创建 | IME 组合事件 (P2-01) | **待 Windows 实机验收** | `onCompositionStart` / `onCompositionEnd` 及 `isComposing` guard 隔离 Enter 选字事件 |
| S1-20 | 快速连续修改勾选 20 次后退出/重启 | 最终状态与重启前一致，且无重复任务 | 防抖与原子存储 (P0-03) | **待 Windows 实机验收** | 退出前调用 `storage.flush()` 强制落盘，杜绝最后 400ms 数据丢失 |
| S1-21 | 断网操作新增、编辑、删除、导出 | 正常使用，不出现登录/网络失败弹窗 | 离线测试 | **待 Windows 实机验收** | 第一阶段 100% 离线运行，零云端依赖、零网络请求 |
| S1-22 | 点击 × 后从托盘恢复 | 隐藏到托盘并保留全部状态；托盘按钮有效 | 主进程托盘测试 (P1-05) | **待 Windows 实机验收** | 依据 `closeToTray` 设置分别处理最小化托盘或受控退出 |
| S1-22b | 悬浮窗 Pin 固定与失焦收起 | Pin 固定时常驻置顶，取消固定时点击桌面外部或按 Esc 自动收起 | 窗口事件监听 | **待 Windows 实机验收** | 标题栏提供 Pin 切换，未固定状态下 `blur` 或 `Esc` 自动淡出隐藏 |
| S1-23 | 托盘菜单“真正退出” | 主进程停止；再次启动恢复数据 | 托盘菜单操作 (P0-03) | **待 Windows 实机验收** | 右键托盘「真正退出」先 flush 落盘再停止进程 |
| S1-24 | 重复双击桌面快捷方式 | 只出现一个程序实例、不发生数据竞争 | 单实例锁机制 | **待 Windows 实机验收** | `app.requestSingleInstanceLock()` 拦截第二个实例并唤醒已有窗口 |
| S1-25 | 开关开机自启 | Windows 登录启动行为符合设置，不抢前台焦点 | 系统 IPC (P2-04) | **待 Windows 实机验收** | `app.setLoginItemSettings({ openAtLogin, openAsHidden: true })`，识别静默自启动 |
| S1-26 | AI 等待超过阈值且睡眠/重启后返回 | 有合理提醒，不反复弹通知，不误称 AI 完成 | 后台定时检查器 | **待 Windows 实机验收** | 后台每分钟轮询，单轮次去重提醒，文案为「已等待 X 分钟，建议检查」 |
| S1-27 | JSON 导出 → 导入恢复 | 卡片、任务、状态、历史和设置保持正确 | Vitest 单元测试 (P0-01) | **自动化测试通过** | `importData` 创建 `pre_import` 备份并通过 Zod schema 校验后原子落盘 |
| S1-28 | 主数据文件损坏 | 看到恢复/导入界面，不会静默清空或覆盖备份 | Vitest 单元测试 (P0-02) | **自动化测试通过** | 损坏文件保护通过测试：标记 `recoveryRequired=true`，拒绝自动保存写入空数据 |
| S1-29 | 修改系统缩放、多显示器断开 | 主窗口仍可找回，文本和按钮可操作 | 多显示器定位 (P2-02) | **待 Windows 实机验收** | 悬浮小窗位置动态采用 `primaryDisplay.workArea` 坐标体系，适配多屏与任务栏停靠 |
| S1-30 | 生成安装包后在真实 Windows 安装运行 | 软件能启动、保存、托盘驻留，卸载重装数据按约定保留 | electron-builder NSIS | **待 Windows 实机验收** | 已生成 NSIS 独立安装包 `dist/AI Task Board Setup 1.0.0.exe` |
| S1-31 | 悬浮窗一键直达完整工作台 | 点击悬浮窗底部「查看全部 >」能顺畅激活并打开层 2 完整任务管理面板 | 跨窗口 IPC 联动 | **待 Windows 实机验收** | 悬浮窗底部按钮触发 `window:openMainBoard`，即时唤醒并聚焦 1180×760 主管理面板 |

---

## 阶段1细节专项优化记录 (Post-Review Optimizations)

1. **悬浮小窗顶部手柄拖拽支持 (Widget Dragging)**:
   - 在 `WidgetView.tsx` 顶部栏注入 `WebkitAppRegion: 'drag'`，Pin 与关闭按钮设置 `WebkitAppRegion: 'no-drag'`。用户可自由拖拽悬浮窗停靠至任意桌面位置。
2. **多开单实例呼起行为修正 (Second Instance Behavior)**:
   - 在 `main/index.ts` 中修正 `second-instance` 事件：重复双击快捷方式时始终恢复、置顶并聚焦现有主面板或悬浮窗，杜绝原 `toggleWidgetWindow()` 误将已打开窗口隐藏的问题。
3. **卡片新建与复制排序一致性优化 (Card Ordering & Prepending)**:
   - 在 `App.tsx` 中创建新卡片与复制卡片时统一赋予 `order: 0` 并对全量卡片重新编号，保证默认 MANUAL 排序下新卡片必然置于看板最顶端。
4. **Windows 文件锁原子写入容灾 (Windows File-Lock Atomic Write Fallback)**:
   - 在 `storage.ts` 的 `writeAtomicWithBackup` 中增加对 Windows 防病毒/索引服务偶发独占文件锁（`EBUSY` / `EPERM` / `EEXIST`）的捕获与 `copyFileSync` 安全覆盖降级，并在备份轮换时清理冲突目标。
5. **回归测试套件扩充**:
   - `tests/domain.test.ts` 增加卡片顺序移动与连续下标校验；
   - `tests/storage-service.test.ts` 增加损坏后全新初始化安全落盘校验；
   - 全套 23 项自动化测试全部通过，TypeScript 0 告警，Windows NSIS 安装包打包成功。

---

## 第二轮代码审查（Round 2）修复与强化记录

依据 `AI_Task_Board_Review_Round2_772721f.md` 审核意见，已针对 P0-01～P0-04 与 P1-01～P1-04 全量落实增量修复方案：

1. **P0-01 退出时渲染进程最后编辑防丢协议 (Guaranteed Exit Flush Protocol)**:
   - 渲染进程通过 `pendingDataRef` 追踪未落盘修改；
   - 主进程在「真正退出」、窗口关闭与 `before-quit` 时，先发送 `system:request-flush` 唤醒渲染进程强制提交流水，等待渲染确认 ACK 后再调用 `storageService.flush()` 落盘并退出，杜绝 400ms 防抖区间内退出丢数据。
2. **P0-02 IPC 数据广播防回显覆盖与单调递增版本号 (Anti-Echo & Monotonic Revision)**:
   - 主进程 `storage:saveData` 广播过滤发送方 `event.sender.id`，保存成功后绝不将自身数据广播回显给保存发起窗口；
   - `AppData` 引入单调递增 `revision` 字段，渲染进程对晚到的旧版本广播直接丢弃，彻底消除并发编辑覆盖风险。
3. **P0-03 StorageService 写入队列真确认语义 (Serialized Promise Write Queue)**:
   - 重构 `StorageService.saveData` 为严格 Promise 链式写入队列，多并发保存合并时确保每个请求的 Promise 仅在真实磁盘落盘完毕后才 resolve；
   - `flush()` 显式等待当前 in-flight 与队列全部执行完毕；`importData`、`restoreFromBackup`、`initializeClean` 全部经由同一串行锁。
4. **P0-04 Windows 重命名与原子替换回滚保护 (Windows Retry & Rollback File Replacement)**:
   - 替换文件时针对 Windows 杀软/索引服务瞬态锁提供 5 次指数退避重试；
   - 重试失败后进入保护降级分支：必须先创建带时间戳的 `.rollback` 快照后方可执行覆盖复制，复制若抛错立即由回滚副本无损还原原文件，绝不破坏既有数据。
5. **P1-01 卡片原生 HTML5 拖拽重排 (Native HTML5 Card Drag and Drop)**:
   - `TaskCard.tsx` 增加 `draggable={isManualSort}`、`onDragStart`、`onDragOver` 与 `onDrop` 事件，拖拽悬停触发高亮指示环；在手动排序下支持拖动卡片重排，自动排序模式提供友好 Tooltip 提示。
6. **P1-02 局部非破坏性撤销恢复 (Non-Destructive Target Undo)**:
   - 卡片删除撤销改为以被删卡片为单位的位置切片还原（Splicing），不影响其他卡片的新编辑；
   - 子任务删除撤销通过 `restoreTaskItem` 仅将目标任务插回父节点原下标，完全保留其他兄弟任务的任何修改。
7. **P1-03 托盘快捷创建卡片标题动态计算 (Dynamic Card Naming)**:
   - `handleAddNewCard` 移入 `setData(prev => ...)` 闭包内根据实时的 `prev.cards.length` 计算名称，多次从托盘呼起快速新增卡片不会产生重名。
8. **P1-04 AI 超时通知去重持久化 (Persistent AI Notification Deduplication)**:
   - `storageService` 维护持久化 `notified_rounds.json`，应用重启或休眠唤醒后不重复触发同一轮次超时弹窗。
9. **自动化回归测试套件**:
   - 自动化测试用例扩充至 26 项（`tests/domain.test.ts` 15项，`tests/storage-domain.test.ts` 3项，`tests/storage-service.test.ts` 8项），全部通过；
   - TypeScript 类型检查 0 错误；
   - Windows 安装包生成成功：`AI Task Board Setup 1.0.0.exe`（83.8 MB）。





---

## 界面与信息层级重构验收记录 (UI Refactor v1.0)

依据 `AI_Task_Board_UI_Refactor_Spec_v1.md` 要求，在不引入 Stage 2 Agent API 及 Stage 3 DeepSeek 的前提下，彻底优化双窗口界面的信息层级，解决“功能全部摊在表面”与“悬浮窗空洞/低对比度”的问题：

### 1. 旧界面问题与新界面解决方案对比 (Before vs. After)

| 模块 | 旧界面存在的问题 | 新界面解决方案 | 验收状态 |
|---|---|---|---|
| **主界面顶部** | 上下堆叠两套统计/筛选按钮，第一行五个大色块筛选，第二行又一排过滤标签，信息臃肿重复 | 第一行收敛为单行：极简品牌 + 摘要文本（如 `3 个任务 · 1 个待验收`） + 低权重保存状态 + `+ 新建卡片` + 设置图标；第二行收敛为搜索框 + **唯一一组状态筛选** (`全部/待开始/AI执行中/待验收/阻塞/已完成/已逾期`) + 排序下拉框 | **已完成** |
| **主界面卡片** | 只有 1 张卡片时被硬拉至半屏；卡片表面常驻展示 3 个大文本框（最近进展/阻塞/下一步）与长输入框，像后台录入表单 | 卡片宽度严格限制在 `max-w-[420px]`，单张卡片靠左留白自然；卡片正面仅保留标题、状态、进度条与单行「当前」「下一步」摘要；低频操作收入多 Tab 详情弹窗 (`TaskDetailModal`) | **已完成** |
| **任务树添加** | 卡片展开时常驻大输入框与“暂无子任务”大白块 | 改为轻量级 `+ 添加任务` 按钮，点击后原地展开输入框（支持 Enter 保存与 Esc 取消）；保留递归多级子任务树与父节点半选 | **已完成** |
| **主界面空状态** | 0 张卡片时缺少明确视觉重心 | 优雅居中图标 + `还没有任务卡片` + 醒目 `+ 新建任务卡片` 按钮 + 辅助链接 `载入演示项目 (FMU + MuJoCo)` | **已完成** |
| **小窗空状态** | 无任务时固定 490px 高度，大面积惨白留白，浅灰文字在透明背景上几乎无法辨认 | 窗口高度根据内容动态收缩至 **~205px**，采用深海军蓝 (`#0f172a`) 实体降级与磨砂玻璃结合，高对比度正文 (>7:1)，中部居中提示与 `+ 创建第一个任务` 按钮 | **已完成** |
| **小窗多任务** | 重点卡片不明确，信息密度不均 | 实施 Hero 卡片优先权算法：`待验收 > 阻塞 > AI执行中 > 待开始 > 已完成`；Hero 卡片下最多显示 2~3 个精简条目，点击次级条目平滑切换 Hero | **已完成** |
| **小窗尺寸联动** | 窗口尺寸固定 360×490 | 宽度统一为 350px；高度基于卡片数动态贴合（0张 ~205px，1张 ~310px，2张 ~365px，3张以上 ~425px），右下角锚定停靠 | **已完成** |

### 2. 真实应用 Windows 截图 (docs/screenshots)

1. `01-main-single-card.png`: **主界面单张卡片默认摘要态**（避免卡片过宽，靠左自然对齐）。
2. `02-main-three-cards.png`: **主界面多卡片层级排列**（显示两张折叠、一张展开，包含多级子任务树与半选进度）。
3. `03-main-detail-modal.png`: **任务详情与 AI 进展设置弹窗**（三 Tab：基本信息、AI 协同工作状态、进展记录历史与追加）。
4. `04-widget-empty.png`: **悬浮小窗 0 任务紧凑空状态**（高度收敛至 205px，深色高对比度，消除 490px 虚无大空白）。
5. `05-widget-three-tasks.png`: **悬浮小窗 3 任务 Hero 优先展示**（`待验收` 任务自动成为 Hero，次级条目紧凑排列，色彩明确区分）。
6. `06-widget-to-main.png`: **从小窗点击“查看全部”后无缝激活聚焦主面板**。

### 3. 验收质量度量 (Quality Metrics)

- **Vitest 自动化测试套件**: 28 项全绿通过 (`tests/domain.test.ts` 17 项，`tests/storage-domain.test.ts` 3 项，`tests/storage-service.test.ts` 8 项)；
- **TypeScript 类型检查**: `npm run typecheck` 严格 0 告警；
- **生产构建打包**: `electron-vite build` 1.55s 构建完成，NSIS 安装包生成：`dist/AI Task Board Setup 1.0.0.exe`（84.1 MB）；
- **双窗口事件驱动同步**: 主界面任意编辑即时通过 IPC `data-updated` 事件广播刷新小窗，小窗切换或点击直达主界面，零轮询、零覆盖。
