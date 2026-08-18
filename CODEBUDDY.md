# 项目指令 (CODEBUDDY.md)

## 项目简介
本项目在 `/home/johnny/test/pl_test` 目录下，目标是开发一款类似《幻兽帕鲁》(Palworld) 的**网页游戏**。
参考现有帕鲁数据网站的**结构与字段设计**来构建游戏内容（帕鲁/宝宝图鉴、属性、技能、工作适性、掉落物、刷新位置、配种等）。

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
- 帕鲁数据模型建议字段：名称、编号、元素/属性、稀有度、HP/攻击/防御/速度等战斗属性、工作适性（采集/种植/搬运/发电等及等级）、伙伴技能、可学主动技能、被动技能、掉落物、刷新位置、配种组合。
- 详细背景与字段清单见 `PROJECT_NOTES.md`。

## 协作偏好
- 用户使用中文沟通，回复优先使用中文。
- 动手前先确认方向（设计数据模型 / 搭建项目骨架 / 抓取参考结构 等）。
- **每完成一个功能后立即 git commit**（commit 消息用中文简述本次功能）。若目录还不是 git 仓库，先 `git init` 并加 `.gitignore`（忽略 node_modules、dist）；仅本地提交，未经许可不 push。
