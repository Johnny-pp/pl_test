#!/usr/bin/env python3
"""
从 paldb.cn 抓取指定帕鲁的参考字段，映射成本项目的 pal.schema.json 结构。

用法:
  python3 scripts/fetch-paldb.py Lamball Cattiva Foxparks ... > data/pals.json

数据来源:
  - 结构化接口: https://paldb.cn/api/pal/<slug>  (gzip, 需 --compressed)
    提供: 图鉴编号、中文名、元素、工作适性(类型+等级)、饱食度、描述、
          伙伴技能(名称/描述/各级掉落物)、是否 Boss 形态。
  - 详情页 HTML: https://paldb.cn/pals/<slug>
    提供: HP / 攻击 / 防御 / 工作速度 等数值，以及"主动技能"中文名列表。
          (paldb 仅渲染昼夜刷新点数量+地图链接，无区域名，刷新区域按经验占位)

说明（版权与字段完整性）:
  - 仅作"结构/数值参考"，数据版权归 Palworld/paldb.cn，商用前请自行确认授权。
  - paldb 不提供 移动速度 / 骑行速度 / 刷新区域名 / 被动技能 / rarity：
      移动速度/骑行速度 → MOVE_MAP 经验占位；
      刷新区域 → SPAWN_MAP 经验占位；
      主动技能 → 从 HTML 抓取真实名称；
      被动技能为 Palworld 全局随机特性，非帕鲁专属，故留空。
"""
import json
import re
import sys
import urllib.request

ELEM_MAP = {
    "无属性": "neutral", "火属性": "fire", "水属性": "water", "草属性": "grass",
    "电属性": "electric", "冰属性": "ice", "地属性": "ground", "风属性": "wind",
    "暗属性": "dark", "龙属性": "dragon", "岩属性": "rock", "普通属性": "normal",
}
WORK_MAP = {
    "手工作业": "handiwork", "搬运": "transport", "牧场": "farming", "采集": "gathering",
    "点火": "kindling", "浇水": "watering", "种植": "planting", "播种": "planting",
    "农业": "farming", "农场": "farming", "发电": "electricity", "生电": "generating",
    "伐木": "lumbering", "采矿": "mining", "制药": "medicine", "冷却": "cooling",
    "分拣": "sorting",
}
STAT_MAP = {
    "HP": "hp", "攻击": "attack", "防御": "defense", "工作速度": "workSpeed",
}
# 移动速度 / 骑乘冲刺速度（paldb 页面未渲染，按 Palworld 经验给的占位值，非精确数值）。
# moveSpeed=地面奔跑速度；rideSprintSpeed=骑乘冲刺速度(0=不可骑乘)。
MOVE_MAP = {
    "Lamball": (300, 0), "Cattiva": (350, 0), "Foxparks": (400, 0),
    "Lifmunk": (400, 0), "Pengullet": (400, 0), "Teafant": (350, 0),
    "Jolthog": (500, 0), "Rooby": (500, 0), "Tanzee": (450, 0),
    "Rushoar": (450, 900), "Daedream": (500, 0), "Vanwyrm": (800, 1300),
}
# 刷新区域（paldb 仅提供昼夜刷新点数量+地图链接，无区域名；以下按 Palworld 经验给占位）
SPAWN_MAP = {
    "Lamball": ["初始台地", "翠绿溪谷"],
    "Cattiva": ["初始台地", "翠绿溪谷"],
    "Foxparks": ["初始台地", "翠绿溪谷（火山口附近）"],
    "Lifmunk": ["初始台地", "翠绿溪谷", "风滚草草原"],
    "Pengullet": ["落日内海", "海岸线"],
    "Teafant": ["初始台地（水边）", "翠绿溪谷"],
    "Jolthog": ["初始台地", "翠绿溪谷"],
    "Rooby": ["翠绿溪谷", "火山地带"],
    "Tanzee": ["翠绿溪谷", "风滚草草原"],
    "Rushoar": ["风滚草草原", "落日内海"],
    "Daedream": ["初始台地（夜晚）", "翠绿溪谷（夜晚）"],
    "Vanwyrm": ["巍雪峰", "火山上空"],
}
HEADERS = {"User-Agent": "Mozilla/5.0"}


def get(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "ignore")


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={**HEADERS, "Accept-Encoding": "gzip"})
    import gzip
    with urllib.request.urlopen(req, timeout=20) as r:
        raw = r.read()
    if raw[:2] == b"\x1f\x8b":  # gzip 魔数，部分缓存命中返回未压缩
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8", "ignore"))


def parse_prob(p: str) -> int:
    m = re.search(r"(\d+)", p or "")
    return int(m.group(1)) if m else 0


def parse_skills(html: str) -> list:
    """从帕鲁详情页 HTML 提取主动技能中文名（paldb 服务器渲染，真实可抓）。"""
    m = re.search(r"主动技能</h3>.*?(?=<h3|</section)", html, re.S)
    block = m.group(0) if m else html
    return re.findall(r'href="/skills/[^"]+".*?<h4[^>]*>([^<]+)</h4>', block, re.S)


def parse(slug: str) -> dict:
    api = get_json(f"https://paldb.cn/api/pal/{slug}")
    html = get(f"https://paldb.cn/pals/{slug}")

    number = int(api.get("number", 0) or 0)
    zh = api.get("name_cn") or slug
    elements = [ELEM_MAP.get(e, "neutral") for e in api.get("element", [])] or ["neutral"]

    # 数值（来自 HTML）
    stats = {k: 0 for k in ("hp", "attack", "defense", "workSpeed", "moveSpeed", "rideSprintSpeed")}
    for label, val in re.findall(
        r'class="text-gray-400">([^<]+)</span><span class="text-white font-bold">([^<]+)</span>', html
    ):
        if label in STAT_MAP:
            try:
                stats[STAT_MAP[label]] = int(val)
            except ValueError:
                pass
    # 移动速度/骑行速度 paldb 页面未渲染，按 Palworld 经验给占位值
    stats["moveSpeed"], stats["rideSprintSpeed"] = MOVE_MAP.get(slug, (100, 0))

    # 工作适性（来自 API，含等级）
    work = []
    for w in api.get("work_skills", []):
        work.append({"type": WORK_MAP.get(w["name"], w["name"]), "level": int(w.get("level", 0))})

    # 伙伴技能 + 掉落（来自 API）
    ps = api.get("partner_skill") or {}
    drops = []
    tables = ps.get("level_tables") or []
    if tables:
        for it in (tables[0].get("items") or []):
            drops.append({"item": it.get("name", ""), "rate": parse_prob(it.get("probability", ""))})
    partner = {
        "name": ps.get("name", ""),
        "description": (ps.get("description") or "").replace("\n", " ").strip(),
        "ranks": [],
    }

    # 主动技能（来自 HTML，真实可抓）；被动技能为 Palworld 全局随机特性，非帕鲁专属，留空
    active = parse_skills(html)
    spawn = SPAWN_MAP.get(slug, [])

    return {
        "id": number or 0,
        "name": {"zh": zh, "en": slug},
        "description": (api.get("summary") or "").replace("\n", " ").strip(),
        "rarity": 2,
        "elements": elements,
        "stats": stats,
        "workSuitability": work,
        "partnerSkill": partner,
        "activeSkills": active,
        "passiveSkills": [],
        "drops": drops,
        "spawnLocations": spawn,
        "breeding": {"power": 0, "parents": []},
    }


def main() -> None:
    slugs = sys.argv[1:]
    if not slugs:
        print("用法: python3 scripts/fetch-paldb.py <slug1> <slug2> ...", file=sys.stderr)
        sys.exit(1)
    out = []
    for slug in slugs:
        try:
            out.append(parse(slug))
            print(f"✓ {slug}", file=sys.stderr)
        except Exception as e:
            print(f"✗ {slug}: {e}", file=sys.stderr)
    # number 缺失(=0)时回退为顺序编号，避免 id 非法/重复
    max_id = max((p["id"] for p in out if p["id"] > 0), default=0)
    for p in out:
        if p["id"] == 0:
            max_id += 1
            p["id"] = max_id
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
