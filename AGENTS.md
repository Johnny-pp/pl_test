# AGENTS.md — 项目协作指令

## 项目简介
本项目在 `/home/johnny/test/pl_test` 目录下，目标是开发一款类似《幻兽帕鲁》(Palworld) 的**网页游戏**。
参考现有帕鲁数据网站的**结构与字段设计**来构建游戏内容（帕鲁/宝宝图鉴、属性、技能、工作适性、掉落物、刷新位置、配种等）。

核心游戏循环规划为：

> 探索地图 → 遭遇幻兽 → 战斗与捕获 → 编组和养成 → 基地生产 → 解锁新区域

完整开发路线和阶段验收标准见 `PLAN.md`，详细背景与字段说明见 `PROJECT_NOTES.md`。

## 当前项目状态

当前已经完成图鉴原型、1 对 1 回合制战斗 Demo，以及捕获/队伍/本地存档，尚未形成完整游戏循环：

- 收录 12 只帕鲁的基础数据与详情展示
- 收录 26 个全局被动技能，支持分类筛选
- 图鉴支持名称、编号、属性、工作和地点搜索
- 图鉴支持编号、名称、稀有度、HP 和攻击排序
- 筛选状态与滚动位置使用 localStorage 持久化
- 帕鲁及被动技能数据由 JSON Schema 校验
- 收录 12 个原创主动技能，使用独立数据表、Schema 和跨表引用校验
- 支持选择出战幻兽、随机遭遇、元素克制、能量、先手和胜负结算
- 战斗核心规则与 Phaser 场景分离，并已有自动化规则测试
- 战斗胜利后可以按剩余 HP、稀有度和基础捕获率尝试捕获
- 玩家拥有的幻兽使用独立个体模型，支持六只队伍编组
- 玩家存档带版本号，可迁移旧数据并在损坏时安全回退
- `npm run validate` 与 `npm run build` 当前可以通过

下一阶段最高优先级是完成 **第一张探索地图与随机遭遇**，依次实现地图场景、玩家移动与碰撞、区域遭遇表，以及地图和战斗场景之间的状态往返。不要在没有确认的情况下跨阶段同时实现基地、配种或多张大地图。

## 技术栈与关键目录

- Phaser 4 + TypeScript + Vite
- `src/scenes/`：图鉴、详情和被动技能等 Phaser 场景
- `src/types/`：TypeScript 数据类型
- `src/data/`：JSON 数据加载模块
- `src/battle/`：不依赖 Phaser 的战斗规则模块
- `src/capture/`：捕获概率与判定规则
- `src/player/`：幻兽个体、队伍与版本化存档
- `tests/`：核心规则自动化测试
- `data/`：帕鲁与被动技能 JSON 数据
- `schema/`：JSON Schema 定义
- `scripts/`：数据抓取和校验脚本
- `PLAN.md`：分阶段开发计划与验收标准
- `PROJECT_NOTES.md`：项目背景、数据来源和字段说明

## 常用命令

- `npm run dev`：启动本地开发服务器；Vite 已允许同一局域网访问
- `npm run validate`：校验帕鲁和被动技能数据
- `npm test`：运行战斗等核心规则测试
- `npm run build`：执行 TypeScript/Vite 生产构建

修改数据结构或数据文件后必须运行 `npm run validate`；修改 TypeScript、场景或构建配置后至少运行 `npm run build`。新增战斗等核心规则后，应补充对应自动化测试。

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
- **每完成一个功能后立即 git commit**（commit 消息用中文简述本次功能）。若目录还不是 git 仓库，先 `git init` 并加 `.gitignore`（忽略 node_modules、dist）；仅本地提交，未经许可不 push。
- 提交前只暂存当前功能涉及的文件，不得顺带覆盖、删除或提交用户的无关改动。
