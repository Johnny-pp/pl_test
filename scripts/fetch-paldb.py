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
    提供: HP / 攻击 / 防御 / 工作速度 等数值（移动速度/骑行速度页面未渲染）。

说明（版权与字段完整性）:
  - 仅作"结构/数值参考"，数据版权归 Palworld/paldb.cn，商用前请自行确认授权。
  - paldb 不提供 移动速度 / 骑行速度 / 刷新位置 / 主动技能 / 被动技能 / rarity，
    这些字段为默认值或留空，需你自行补全（建议对着游戏或 paldb 页面手填）。
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
    # 移动速度/骑行速度 paldb 页面未渲染，置默认占位
    stats["moveSpeed"] = 100
    stats["rideSprintSpeed"] = 0

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

    return {
        "id": number or 0,
        "name": {"zh": zh, "en": slug},
        "description": (api.get("summary") or "").replace("\n", " ").strip(),
        "rarity": 2,
        "elements": elements,
        "stats": stats,
        "workSuitability": work,
        "partnerSkill": partner,
        "activeSkills": [],
        "passiveSkills": [],
        "drops": drops,
        "spawnLocations": [],
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
