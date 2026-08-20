# AGENTS.md — 项目协作指令

## 项目简介
本项目在 `/home/johnny/test/pl_test` 目录下，目标是开发一款类似《幻兽帕鲁》(Palworld) 的**网页游戏**。
参考现有帕鲁数据网站的**结构与字段设计**来构建游戏内容（帕鲁/宝宝图鉴、属性、技能、工作适性、掉落物、刷新位置、配种等）。

核心游戏循环规划为：

> 探索地图 → 遭遇幻兽 → 战斗与捕获 → 编组和养成 → 基地生产 → 解锁新区域

完整开发路线和阶段验收标准见 `PLAN.md`，详细背景与字段说明见 `PROJECT_NOTES.md`。

## 当前项目状态

当前已经完成 PLAN.md 的十四个阶段并开始阶段十五，具备图鉴、战斗、捕获/队伍/存档、三地区探索基础、在线探索挂机、成长养成、基地生产、配种孵化、任务首领、响应式视觉与工程发布能力：

- 收录 18 只帕鲁的基础数据与详情展示
- 收录 26 个全局被动技能，支持分类筛选
- 图鉴支持名称、编号、属性、工作和地点搜索
- 图鉴支持编号、名称、稀有度、HP 和攻击排序
- 筛选状态与滚动位置使用 localStorage 持久化
- 帕鲁及被动技能数据由 JSON Schema 校验
- 收录 17 个原创主动技能，使用独立数据表、Schema 和跨表引用校验
- 支持选择出战幻兽、随机遭遇、元素克制、能量、先手和胜负结算
- 战斗核心规则与 Phaser 场景分离，并已有自动化规则测试
- 战斗胜利后可以按剩余 HP、稀有度和基础捕获率尝试捕获
- 玩家拥有的幻兽使用独立个体模型，支持六只队伍编组
- 玩家存档带版本号，可迁移旧数据并在损坏时安全回退
- 支持瓦片地图移动、边界/障碍碰撞、摄像机跟随和基础采集
- 地图按区域和昼夜使用不同遭遇表，战斗后可恢复原坐标与采集状态
- `?start=world` 可直接启动探索地图，用于开发检查和局域网演示
- 18 个物种、17 个主动技能和 26 个被动技能均已原创化
- 战斗支持完整元素矩阵，以及灼烧、中毒、冻结和属性增益
- 数据校验覆盖 Schema、唯一性、主动/被动技能引用、工作适性和遭遇表引用
- 基地支持岗位分配、离线生产、资源容量、设施升级和道具制造
- 捕获会消耗捕获器，野外领队 HP 会写回存档，治疗剂可在队伍页使用
- 配种支持后代预览、食物成本、被动继承、蛋品质、倒计时和四蛋孵化队列
- 野外捕获个体会随机获得原创被动，为配种继承提供来源
- 已接入基础与高地两套原创幻兽头像图集，覆盖图鉴、详情、战斗、队伍与配种
- 支持桌面自适应、移动端触屏地图操作、技能/克制详情、属性对比和 24 条分页
- 非首屏场景首次进入时按需加载，Phaser 引擎独立为异步缓存块
- 页面启动与未处理异常会显示可恢复的中文错误提示
- 队伍页支持 JSON 存档备份导出、结构校验、旧版迁移和导入
- ESLint、Prettier、TypeScript、测试、数据校验和构建已统一为 `npm run check`
- GitHub Actions 会在 push 和 pull request 时执行统一质量门禁
- `README.md` 已整理开发、操作、构建、存档备份和局域网部署说明
- 已实现 50 级成长、三种经验曲线、战斗经验结算和存档 v7 迁移
- 已扩充至 18 个原创物种和 17 个原创主动技能，并加入独立高地头像图集
- 已加入可通过战斗、捕获和基地资源解锁的第二地区“云脊高地”
- 已加入三段远征任务链、奖励幂等结算和具备半血强化机制的风暴领主
- 六只队伍已接入主动/强制换宠战斗，被动技能通过统一规则影响战斗与基地生产
- 已补齐新存档长期循环、500 个体容量和真实 Firefox 浏览器流程验收
- 图鉴筛选与分页、长列表滚动和常用文本按钮已拆分为共享 UI/规则模块
- 游戏画布具备键盘焦点、场景状态播报和移动端尺寸验收
- 探索支持在线自动巡逻、路过采集、普通战斗、按队伍换宠和仅新品种捕获；手动移动或进入后台会停止挂机
- 阶段十五已接通第三地区“星潮群岛”的三区地图、双向渡门、解锁规则和世界探索进度存档基础，地区专属物种与玩法仍在扩充

后续新增功能应在保持统一质量门禁通过的前提下，从扩充原创区域、物种和长期养成内容开始，并继续避免扩大单文件和首屏包体。

## 技术栈与关键目录

- Phaser 4 + TypeScript + Vite
- `src/scenes/`：图鉴、详情和被动技能等 Phaser 场景
- `src/types/`：TypeScript 数据类型
- `src/data/`：JSON 数据加载模块
- `src/battle/`：不依赖 Phaser 的战斗规则模块
- `src/capture/`：捕获概率与判定规则
- `src/player/`：幻兽个体、队伍与版本化存档
- `src/world/`：地图数据、区域划分与昼夜遭遇规则
- `src/base/`：基地岗位、生产、设施、制造和道具使用规则
- `src/breeding/`：后代匹配、品质、被动继承与孵化规则
- `src/ui/`：原创头像图集索引及共享 UI 工具
- `.github/workflows/ci.yml`：持续集成质量门禁
- `tests/`：核心规则自动化测试
- `data/`：帕鲁与被动技能 JSON 数据
- `schema/`：JSON Schema 定义
- `scripts/`：数据校验脚本；不得加入直接搬运外部内容的抓取脚本
- `PLAN.md`：分阶段开发计划与验收标准
- `PROJECT_NOTES.md`：项目背景、数据来源和字段说明

## 常用命令

- `npm run dev`：启动本地开发服务器；Vite 已允许同一局域网访问
- `npm run validate`：校验帕鲁和被动技能数据
- `npm test`：运行战斗等核心规则测试
- `npm run test:browser`：使用 Geckodriver 和无头 Firefox 运行关键浏览器流程验收
- `npm run build`：执行 TypeScript/Vite 生产构建
- `npm run check`：依次执行格式、Lint、类型、测试、数据校验和生产构建

提交前原则上运行 `npm run check`。新增战斗等核心规则时，应补充对应自动化测试。

## 数据参考来源（仅作字段/结构设计的参考，数值请勿直接搬运）
- 中文：paldb.cn、lootlab.cn、gamersky.com/tools/palworldwiki/
- 英文：palpedia.io/en、palworld.gg/pals、pals.wiki/pals、palworldguides.com/pals、pindrop.gg/palworld/pal
- 数据 API：PokeAPI (https://pokeapi.co) 可参考其字段结构

## 参考开源项目 (GitHub)
- devshareacademy/monster-tamer（主线骨架，Phaser 3 RPG）— https://github.com/devshareacademy/monster-tamer
- uehlbran/pokemon-lib-ts（战斗/数据逻辑 TS 库）— https://github.com/uehlbran/pokemon-lib-ts
- digitsensitive/phaser3-typescript（Phaser3+TS 脚手架）— https://github.com/digitsensitive/phaser3-typescript
- Khushankrawat/pokemon-battle-simulator（战斗状态机参考）— https://github.com/Khushankrawat/pokemon-battle-simulator
- AemW/pokemon-battle-simulator（React UI 参考）— https://github.com/AemW/pokemon-battle-simulator
- 详细背景与字段清单见 `PROJECT_NOTES.md`。

## 开发规范
- **禁止直接抓取搬运**上述站点的具体数值/描述用于本项目（版权风险）；只参考数据维度与字段结构，数值自行设计。
- 仓库中已有的参考数据属于原型阶段遗留内容，后续应逐步替换为原创名称、描述、数值、美术和世界观；不得继续扩大直接搬运范围。
- 帕鲁数据模型建议字段：名称、编号、元素/属性、稀有度、HP/攻击/防御/速度等战斗属性、工作适性（采集/种植/搬运/发电等及等级）、伙伴技能、可学主动技能、被动技能、掉落物、刷新位置、配种组合。
- 详细背景与字段清单见 `PROJECT_NOTES.md`。
- 保持物种静态数据与玩家拥有的幻兽个体数据相互独立；等级、经验、当前 HP、随机被动和唯一 ID 应属于个体数据。
- 新增数据字段时同步更新 TypeScript 类型、JSON Schema、示例/实际数据和校验逻辑。
- 优先按 `PLAN.md` 当前阶段拆分小功能，每个功能都应有明确、可验证的完成条件。

## 协作偏好
- 用户使用中文沟通，回复优先使用中文。
- 动手前先确认方向（设计数据模型 / 搭建项目骨架 / 抓取参考结构 等）。
- **每完成一个功能后立即 git commit**（commit 消息用中文简述本次功能）。若目录还不是 git 仓库，先 `git init` 并加 `.gitignore`（忽略 node_modules、dist）。提交commit之后运行git push。
- 用户已明确授权：本项目完成并验证功能后，可将对应提交普通推送到已配置并确认的 `origin/master`（当前为 `git@github.com:Johnny-pp/pl_test.git`）。此授权不包含强制推送、修改远端配置或向其他仓库推送。
- 提交前只暂存当前功能涉及的文件，不得顺带覆盖、删除或提交用户的无关改动。
