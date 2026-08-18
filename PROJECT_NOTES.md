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
- 新增帕鲁数据时应符合该 Schema；字段结构参考 paldb.cn / Palpedia / PokeAPI，数值自行设计。
- 示例数据：`data/pals.json`（2 个原创示例帕鲁）；校验脚本：`scripts/validate-pals.mjs`（`node scripts/validate-pals.mjs`，依赖 ajv）。

## 部署 / 访问（含内网穿透）
> 让其他设备访问本项目的 dev server 或正式版本。已配置 `vite.config.mjs` 的 `server.host: true`，dev 启动会打印 `Network` 地址。

### 1. 同一局域网（同 WiFi/路由器）
- 启动：`npm run dev`，用日志里的 `Network: http://<本机IP>:5173/` 访问。
- 查本机 IP：`hostname -I`(Linux) / `ipconfig`(Win) / `ifconfig`(Mac)。
- 访问不了多为防火墙挡了 5173 端口，放行即可。

### 2. 内网穿透（跨网络/外网访问，最省事）
dev server 只解决局域网，跨网络需穿透工具，任选其一：
- **ngrok**：`npx ngrok http 5173` → 生成公网 URL（免费版随机域名，会过期）。
- **cloudflared**：`cloudflared tunnel --url http://localhost:5173` → 生成稳定公网 URL。
- **frp / 自建**：有服务器时自建 frp 服务端做长期穿透。

### 3. 正式部署（给别人长期玩，推荐）
dev server 不压缩、不校验来源，**勿长期公网暴露**。正式方案：
- 构建：`npm run build` → 产出自包含 `dist/`。
- 托管：`dist/` 传到 Vercel / Netlify / GitHub Pages / 任意静态服务器即可公网访问。
- 注意：`build` 的产物是静态文件，无后端则数据写死在 `data/pals.json` 即可。

### 安全提醒
- dev server 仅用于开发/演示，不要绑定公网 IP 长期运行。
- 穿透工具的公网 URL 任何人可访问，演示完及时关闭。
- 含后端/敏感逻辑时，穿透前务必加鉴权。
