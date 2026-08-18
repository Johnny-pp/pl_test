#!/usr/bin/env python3
"""
从 paldb.cn 抓取指定帕鲁的参考字段，映射成本项目的 pal.schema.json 结构。

用法:
  python3 scripts/fetch-paldb.py Lamball Cattiva Foxparks ... > data/pals.json

说明:
  - 仅作"结构/数值参考"，数据版权归 Palworld/paldb.cn 所有，商用前请自行确认授权。
  - 能稳定抓取的字段: 中文名/英文名/元素/HP/攻击/防御/工作速度/工作适性(类型+等级)/伙伴技能名。
  - 移动速度/骑行速度、掉落物、刷新位置、主动/被动技能等若页面未渲染则留空或给默认值，需自行补全。
  - rarity 站点未提供，统一默认 2；id 按传入顺序编号。
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
    "农业": "farming", "农场": "farming", "发电": "electricity",
    "生电": "generating", "伐木": "lumbering", "采矿": "mining", "制药": "medicine",
    "冷却": "cooling", "分拣": "sorting",
}
STAT_MAP = {
    "HP": "hp", "攻击": "attack", "防御": "defense", "工作速度": "workSpeed",
    "移动速度": "moveSpeed", "骑行速度": "rideSprintSpeed",
}


def fetch(slug: str) -> str:
    url = f"https://paldb.cn/pals/{slug}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "ignore")


def parse(html: str, slug: str, pid: int) -> dict:
    # 名称 + 元素
    m = re.search(r"<title>([^<]+)</title>", html)
    title = m.group(1) if m else slug
    zh = title.split(" - ")[0].strip()
    en = slug
    raw_elem = title.split(" - ")[1].split(" | ")[0] if " - " in title else ""
    elem_label = raw_elem[:-2] if raw_elem.endswith("属性") else raw_elem
    elements = [ELEM_MAP.get(elem_label, "neutral")]

    # 属性数值
    stats = {k: 0 for k in STAT_MAP.values()}
    for label, val in re.findall(
        r'class="text-gray-400">([^<]+)</span><span class="text-white font-bold">([^<]+)</span>', html
    ):
        if label in STAT_MAP:
            try:
                stats[STAT_MAP[label]] = int(val)
            except ValueError:
                pass
    if stats["moveSpeed"] == 0:
        stats["moveSpeed"] = 100
    if stats["rideSprintSpeed"] == 0:
        stats["rideSprintSpeed"] = 0

    # 工作适性 (类型 + 等级)
    work = []
    for wtype, lvl in re.findall(
        r'text-gray-300 text-xs">([^<]+)</div></div><div class="text-blue-400 font-bold text-sm">Lv <!-- -->(\d)',
        html,
    ):
        wt = WORK_MAP.get(wtype, wtype)
        work.append({"type": wt, "level": int(lvl)})

    # 伙伴技能名
    pm = re.search(r"伙伴技能：([^。]+)", html)
    partner = {"name": pm.group(1).strip(), "description": ""} if pm else None

    return {
        "id": pid,
        "name": {"zh": zh, "en": en},
        "description": "",
        "rarity": 2,
        "elements": elements,
        "stats": stats,
        "workSuitability": work,
        "partnerSkill": partner,
        "activeSkills": [],
        "passiveSkills": [],
        "drops": [],
        "spawnLocations": [],
        "breeding": {"power": 0, "parents": []},
    }


def main() -> None:
    slugs = sys.argv[1:]
    if not slugs:
        print("用法: python3 scripts/fetch-paldb.py <slug1> <slug2> ...", file=sys.stderr)
        sys.exit(1)
    out = []
    for i, slug in enumerate(slugs, 1):
        try:
            html = fetch(slug)
            out.append(parse(html, slug, i))
            print(f"✓ {slug}", file=sys.stderr)
        except Exception as e:
            print(f"✗ {slug}: {e}", file=sys.stderr)
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
