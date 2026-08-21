# 项目笔记：幻兽帕鲁风格网页游戏

> 本文件供开发者（含 AI agent）了解项目背景。更完整的跨会话记忆位于
> `~/.codebuddy/projects/home-johnny-test-pl_test/memory/`。

## 项目目标
在 `/home/johnny/test/pl_test` 目录下，开发一款类似《幻兽帕鲁》(Palworld) 的**网页游戏**。
需要参考现有帕鲁数据网站来设计游戏内容（帕鲁/宝宝图鉴、属性、技能、工作适性、掉落物、刷新位置、配种等）。

## 数据参考来源（仅作字段/结构设计的参考，数值请勿直接搬运）
- 中文：
  - paldb.cn — 最全中文库，含配种计算器、互动地图
  - lootlab.cn — 1.0 全 288+ 帕鲁，支持多维筛选
  - gamersky.com/tools/palworldwiki/ — 游民星空图鉴
- 英文：
  - palpedia.io/en — 288 只，可按元素/工作适性/属性筛选
  - palworld.gg/pals
  - pals.wiki/pals
  - palworldguides.com/pals — 299 只
  - pindrop.gg/palworld/pal — 约 300 只

## 参考开源项目 (GitHub)
> 已确认可参考的同方向开源仓库（优先用关注度高、有教程的）：

- **devshareacademy/monster-tamer**（主线骨架）— https://github.com/devshareacademy/monster-tamer
  Phaser 3 做的宝可梦-like RPG，是 Phaser 官方教程系列代码库，关注度高、有配套教程。
- **uehlbran/pokemon-lib-ts**（战斗/数据逻辑）— https://github.com/uehlbran/pokemon-lib-ts
  模块化 TS 库，做宝可梦战斗模拟器/同人游戏，按世代分装数据，参考属性克制/技能/进化。
- **digitsensitive/phaser3-typescript**（工程脚手架）— https://github.com/digitsensitive/phaser3-typescript
  Phaser 3 + TypeScript 模板（Vite/ESLint），比从零搭顺手。
- **Khushankrawat/pokemon-battle-simulator**（战斗流程）— https://github.com/Khushankrawat/pokemon-battle-simulator
  FastAPI + React 回合制战斗模拟，含实时对战，参考战斗状态机。
- **AemW/pokemon-battle-simulator**（UI 参考）— https://github.com/AemW/pokemon-battle-simulator
  React 前端，可搜索下拉选怪开战，UI/数据绑定简单清晰。
- **PokeAPI**（数据来源，类比 paldb.cn）— https://pokeapi.co
  REST API 提供宝可梦全图鉴数据，参考其字段结构设计自有帕鲁数据模型。

## 注意事项
- 这些站点的具体数据（属性数值、技能描述）通常有版权，直接抓取搬运用于商用游戏有风险。
- 建议只参考**结构/字段设计**（如一个帕鲁需要哪些字段：元素、工作适性、伙伴技能、掉落、刷新位置），
  实际数值自行设计或从游戏本体授权数据整理。

## 建议的数据模型字段（帕鲁）
- 基础：名称、编号、元素/属性、稀有度
- 战斗：HP、攻击、防御、速度等属性
- 工作：工作适性（采集/种植/搬运/发电等）及等级
- 技能：伙伴技能、可学主动技能、被动技能
- 掉落物、刷新位置/栖息地
- 配种：可配种组合、后代

## 帕鲁数据模型 Schema
- 已定义 JSON Schema：`schema/pal.schema.json`（draft 2020-12），覆盖身份/元素/属性/工作适性/技能/掉落/分布/配种字段，`additionalProperties:false`。
- 新增幻兽数据时应符合该 Schema；外部资料仅用于理解常见字段维度，内容与数值必须原创设计。
- 当前数据：`data/pals.json`（18 个原创物种）；校验脚本：`scripts/validate-pals.mjs`（依赖 ajv）。

## 原创幻兽数据
- 18 个物种的中英文名称、描述、属性、成长、工作适性、伙伴技能、掉落物和栖息地均为本项目原创设计。
- 图鉴编号沿用原型阶段的内部编号，以兼容已有 localStorage 存档和遭遇表引用；编号本身不代表外部作品内容。
- `catchRate`、`growth`、稀有度、移动/骑行速度等字段已纳入 Schema，不再依赖抓取脚本或站点数据。
- 主动技能独立存放于 `data/active-skills.json`，物种通过稳定 ID 引用。
- 数据校验会检查物种/技能的 Schema、ID 与名称唯一性、主动/被动跨表引用和重复工作适性。

## 等级、经验与属性成长
- 成长规则位于 `src/progression/progression.ts`，与 Phaser 场景解耦，最高等级为 50。
- `growth.experienceCurve` 的 `fast`、`medium`、`slow` 使用不同累计经验阈值；战斗奖励由敌方等级和稀有度共同决定。
- 个体的 `level`、`experience` 和 `currentHp` 保存在玩家存档中；物种基础属性与每级成长值仍保留在静态数据中。
- 等级会提高最大 HP、攻击和防御，并直接参与后续战斗。升级时当前 HP 按最大 HP 增量补充，但不会复活已倒下个体。
- 当前存档版本为 v9，旧存档会迁移并清理非法等级、负经验、负生命值和无效区域标识，同时补齐任务、首领、世界探索、个体构筑与阶段十七（货币、掉落物、支线、NPC、机关、精英、商店库存）进度；个体构筑（技能树、装备技能、装备槽）在迁移时安全补齐。

## 世界地区与解锁
- 第一地区“晴风边境”包含晴风原野和回声遗迹；第二地区“云脊高地”包含雾瀑台地和风暴山脊。
- 地区配置与解锁规则位于 `src/world/regions.ts`，地图生成和昼夜遭遇分别位于 `worldMap.ts` 与 `encounters.ts`。
- 在线探索挂机使用 `src/world/autoExploration.ts` 的网格寻路绕开障碍并前往可达遭遇区；挂机状态仅在地图与普通战斗场景间传递，不写入存档，也不结算后台时间。
- 挂机会采集路过的资源并复用任务事件，普通战斗使用独立自动选技规则；只尝试捕获尚未拥有的物种，传送门、地区解锁与区域首领保持手动。
- 云脊高地需要胜利 3 场、捕获 2 只，并消耗木材 30、石材 20、晶体 5；解锁只扣费一次并写入 v5 存档。
- 六只高地物种使用独立的 `public/assets/pal-portraits-highland.png` 原创头像图集，不增加新的 Phaser 场景或首屏依赖。
- 阶段十五已实现第三地区“星潮群岛”；已接通芦灯港、辉沼湿地和沉星遗迹三区地图、双向渡门及独立图块集。
- 星潮群岛要求领取风暴领主任务的“岚印锻造”、累计胜利 10 场，并消耗食物 40、石材 35、晶体 20；解锁规则保证幂等。
- v7 存档已加入发现地点、一次性世界奖励、已激活传送点和迷雾扇区字段，为后续隐藏内容和地图完成度提供持久化基础。
- 星潮群岛新增 12 个原创物种（编号 40–51，总物种 36 个），辉沼湿地与沉星遗迹使用专属昼夜遭遇表，芦灯港为安全聚落。
- 环境机制为“潮汐/孢雾”：涨潮夜间沉星遗迹弥漫孢雾，发现沉星观测台信标后全局规避；另有 4 个发现地点、3 个隐藏宝箱、1 个回波传送点、1 个稀有刷新点与四扇迷雾分区。
- 星潮群岛含 2 个精英首领（沉星潮卫、辉沼龙君）与 1 个多阶段终章首领（晦曜巨像·沉星终章，半血强化），任务链“星潮远航→沉星终章”奖励“星潮引航”能力。
- 12 个星潮物种使用独立 `public/assets/pal-portraits-startide.png` 原创头像图集（4×3 共 12 格，362×362 帧）。

## 任务与区域首领
- 任务定义、事件匹配、完成判定和奖励规则位于 `src/quests/questSystem.ts`，任务页通过场景加载器按需载入。
- 当前任务链为“远征准备 → 云脊踏勘 → 风暴领主”，覆盖战斗、捕获、区域解锁、采集、制造和首领胜利。
- 风暴领主配置位于 `src/battle/bosses.ts`；首领状态抗性和半血强化由通用战斗引擎执行，不依赖 Phaser。
- 奖励领取、首领胜利和能力解锁均保存于 v6 存档并保证幂等。

## 队伍战斗与被动规则
- `battleEngine.ts` 支持六只队伍、主动换宠、倒下后强制替补和全队败北；换宠与回合规则保持与 Phaser 解耦。
- 主动换宠占用回合并先于敌方行动，强制替补不额外耗回合；每名队员的 HP 与参战经验分别持久化。
- `src/passives/passiveEffects.ts` 是战斗和基地共享的唯一被动数值映射层，统一执行去重、叠加上限和冲突顺序。
- 已实装攻击、防御、速度、承伤、能耗、元素增伤/抗性、工作速度和资源产量；其余被动保留展示与配种继承并在界面明确标注。

## 个体构筑：技能树、招式配置与装备
- 构筑规则位于 `src/build/buildSystem.ts` 与 `src/build/equipment.ts`，与 Phaser 解耦；`src/build/buildCombatant.ts` 把玩家个体换算成战斗快照。
- 技能树由物种可学主动技能、三个属性根节点（强攻/坚守/强体）及其二级节点、以及一个“血脉传承”被动节点组成；属性节点提供平值属性，主动节点解锁可装备技能，被动节点授予全局被动效果。
- 个体升级每级获得 1 点技能点（最高 49 点）；解锁节点有前置与点数限制，重置技能树消耗晶体并返还技能点、恢复基础技能。
- 每个个体最多装备 4 个主动技能，基础技能默认携带，其余需先解锁对应节点；非法或旧版配置在读取时安全回退到基础技能。
- 装备模型包含核心/护符/护甲三个槽位，`data/equipment.json` 收录 18 件原创装备（基础/稀有/传说）并定义百分比与平值词条、元素伤害/抗性。
- 装备词条与技能树属性、随机被动经统一 `BuildBonuses` 合并进最终数值，并应用明确叠加上限；界面显示最终数值、加成来源与未生效原因。
- 战斗使用个体当前装备的 4 个主动技能与构筑后数值；基地生产与战斗读取同一规则层，工作/产量词条真实生效。
- 装备来源：普通战斗低概率掉落、首领首次击败固定掉落、星潮隐藏宝箱与“沉星终章”任务奖励；穿戴/替换/卸下不会复制或丢失物品（槽位仅存背包引用）。
- 当前存档版本为 v9，旧个体迁移时补齐技能树节点、装备技能与空装备槽；装备与个体构筑字段均持久化并可随导入导出迁移。

## 长期循环与工程验收
- `src/balance/balanceBaseline.ts` 记录首领推荐等级、目标战斗场数和孵化时长基线；自动化测试从全新存档模拟任务奖励、高地解锁、采集制造和首领奖励。
- 规模测试使用 500 条模拟物种和 500 条模拟技能反复执行筛选与分页，并验证 500 个玩家个体的备份小于 1 MB且可恢复。
- 图鉴筛选/排序/分页、长列表滚动和常用文本按钮已从场景中抽取到 `src/dex/` 与 `src/ui/`，供后续区域和内容扩展复用。
- `npm run test:browser` 使用 Geckodriver 和无头 Firefox 验收任务、基地、探索挂机、自动战斗/捕获、战斗升级、商店、机关门、精英、支线与存档恢复，同时检查键盘打断、屏幕方向键、390×844 移动端画布和场景状态播报。
- 浏览器测试桥接仅在 `?e2e=1` 时启用；常规首屏仍只加载图鉴场景，Phaser 引擎和其他场景保持独立异步块。

## 阶段十七：NPC、商店、支线与探索能力
- 经济层：`src/shop/shopSystem.ts` 定义通用货币“星币”，`MATERIAL_PRICES` 收录 50 种掉落物收购价，制造品可出售；商店装备限量库存售罄后持久化，购买/出售结算幂等不可重复利用。
- 战斗结算：`src/battle/drops.ts` 胜利按敌方掉落表获得掉落物，并按等级结算星币；掉落物存入 `inventory.materials`。
- 支线：`src/quests/sideQuests.ts` 收录芦灯萤语、雾潮采药、潮音回响、商旅的委托、沉星守望者、退潮秘径 6 条，覆盖对话/采集/收集/发现/制造/买卖/精英/机关/宝箱等目标类型，按前置与第三地区解锁自动激活并幂等领奖。
- 探索能力：`data/explore-abilities.json` 与 `schema/explore-ability.schema.json` 定义砍藤/碎岩/涉水/滑翔/照明 5 种能力，`pal.schema.json` 与物种数据新增 `exploreAbilities` 字段；`src/explore/gates.ts` 在星潮群岛部署 5 座机关门，开启隐藏宝箱与潮顶瞭望点，已开启状态持久化。
- 精英：`src/explore/elites.ts` 定义滩头巡逻兵·羽翎与深潜客·潮髓，首次击败发放一次性奖励，重战受可配置冷却约束。
- 聚落：`src/world/settlementContent.ts` 收录芦灯港 5 名原创 NPC（商贩/疗愈师/旅人/渔人/守灯长老），`WorldScene` 提供对话覆盖层、商店入口、队伍治疗与支线引导。
- 存档升级至 v9，迁移补齐货币、掉落物、支线、NPC 对话、精英、机关与商店库存状态并清理损坏数据；任务页支持主线/支线切换与滚动，队伍页展示探索能力。

## 被动技能全局表
- 文件：`data/passive-skills.json`，对应 Schema：`schema/passive-skill.schema.json`（draft 2020-12）。
- 字段：`id`(slug)、`name{zh,en}`、`category`(attack/defense/work/move/element/resource/other)、`description`(效果描述)、`tier`(common/rare/legendary)。
- 当前收录 26 个原创被动技能，包含移动、战斗、工作、资源和元素等分类。
- 校验：`npm run validate` 同时校验物种、主动技能和被动技能，并执行跨表引用检查。

## 局域网访问（仅本机 + 同 WiFi/路由器的其他设备）
> 已配置 `vite.config.mjs` 的 `server.host: true`，dev 启动会打印 `Network` 地址，同局域网设备直接用该地址访问即可，无需公网/内网穿透。

- 启动：`npm run dev`，日志里的 `Network: http://<本机IP>:5173/` 即局域网地址。
- 查本机 IP：`hostname -I`(Linux) / `ipconfig`(Win) / `ifconfig`(Mac)。
- 访问不了多为防火墙挡了 5173 端口，放行即可。
- 当前阶段只需局域网演示，不做外网暴露。
