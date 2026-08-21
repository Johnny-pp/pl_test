# 第三方依赖与素材声明

本项目为原创单机网页游戏，代码与游戏内容（物种、技能、装备、任务、地图、数值、音效与头像）均为原创。以下列出运行与构建所依赖的开源组件及授权素材。

## JavaScript / 运行时依赖

| 组件 | 用途 | 许可证 |
| --- | --- | --- |
| [Phaser](https://phaser.io) | HTML5 游戏引擎（场景、渲染、输入、物理） | MIT |
| [Vite](https://vite.dev) | 前端构建与开发服务器 | MIT |
| [ajv](https://ajv.js.org) | JSON Schema 数据校验 | MIT |

## 开发 / 质量工具

- TypeScript（Apache-2.0）
- ESLint（MIT）
- Prettier（MIT）
- typescript-eslint（MIT）
- Node.js 内置测试运行器（不需要额外依赖）

## 美术素材

- `public/assets/ui/kenney/*` — UI 按钮与面板素材，来自 Kenney Vleugels 的 UI pack。
  - 授权：**CC0 1.0 Universal**（https://creativecommons.org/publicdomain/zero/1.0/）
  - 随附授权文件：`public/assets/ui/kenney/LICENSE.txt`；来源：https://github.com/ereborstudios/kenney-ui-pack
- 幻兽头像、地图瓦片、探索机关与粒子等其余美术均为本项目原创 SVG/PNG。

## 音频

- 全部音效与环境音乐由本项目使用 Web Audio API 实时合成，无第三方音频素材。

## 数据参考

- 游戏数据字段结构参考了帕鲁资料站与 PokeAPI 的数据维度（见 `PROJECT_NOTES.md`），但不包含任何外部站点的名称、描述或数值。

## 开源协议

- 本项目原创代码采用 MIT License（见 `LICENSE`）。
- 本项目不附带任何官方授权方的支持或背书。