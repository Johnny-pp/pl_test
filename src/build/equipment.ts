import type { GameSave } from "../player/playerState.ts";
import type {
  EquipmentDefinition,
  EquipmentItem,
  EquipmentRarity,
  EquipmentSlot,
} from "../types/skillTree.ts";

const SLOTS: EquipmentSlot[] = ["core", "charm", "armor"];

function createItemUid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `eq-${globalThis.crypto.randomUUID()}`;
  }
  return `eq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Adds a new equipment item to the player inventory. */
export function grantEquipment(
  save: GameSave,
  equipmentId: string,
  idFactory: () => string = createItemUid
): { save: GameSave; item?: EquipmentItem } {
  const item: EquipmentItem = { uid: idFactory(), equipmentId };
  return {
    item,
    save: { ...save, inventory: { ...save.inventory, equipment: [...save.inventory.equipment, item] } },
  };
}

/** Rolls an equipment id from a weighted pool by rarity. */
export function rollEquipmentId(
  pool: readonly { id: string; rarity: EquipmentRarity }[],
  rarity: EquipmentRarity,
  random: () => number = Math.random
): string | undefined {
  const candidates = pool.filter((entry) => entry.rarity === rarity);
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(random() * candidates.length)]?.id;
}

const BOSS_DROPS: Record<string, string> = {
  "storm-lord": "charm-stormlord-horn",
  "abyssal-colossus": "armor-colossus-casing",
  tidewarden: "core-abyssal-heart",
  "mire-sovereign": "armor-colossus-casing",
};

/** Determines the equipment a boss drops on first defeat. */
export function rollEquipmentDropForBoss(bossName: string, bossId: string): string | undefined {
  void bossName;
  return BOSS_DROPS[bossId];
}

/**
 * Equips an inventory item onto a pal's slot. Items stay in the inventory and
 * the slot only stores a reference, so no item is ever duplicated or lost.
 * Equipping an item that is already used by another slot of the same pal moves
 * that reference to the requested slot.
 */
export function equipItem(
  save: GameSave,
  palUid: string,
  itemUid: string,
  slot: EquipmentSlot,
  slotDefinitions: ReadonlyMap<string, EquipmentDefinition>
): GameSave {
  const instance = save.ownedPals.find((item) => item.uid === palUid);
  const item = save.inventory.equipment.find((entry) => entry.uid === itemUid);
  if (!instance || !item) return save;
  const definition = slotDefinitions.get(item.equipmentId);
  if (!definition || definition.slot !== slot) return save;
  if (instance.equipment?.[slot] === itemUid) return save;

  const equipment = { ...(instance.equipment ?? {}) };
  for (const otherSlot of SLOTS) {
    if (otherSlot !== slot && equipment[otherSlot] === itemUid) delete equipment[otherSlot];
  }
  equipment[slot] = itemUid;
  return {
    ...save,
    ownedPals: save.ownedPals.map((entry) => (entry.uid === palUid ? { ...entry, equipment } : entry)),
  };
}

/** Removes an equipped reference so the item remains available in the inventory. */
export function unequipItem(save: GameSave, palUid: string, slot: EquipmentSlot): GameSave {
  const instance = save.ownedPals.find((item) => item.uid === palUid);
  if (!instance) return save;
  const equipment = instance.equipment ?? {};
  const itemUid = equipment[slot];
  if (!itemUid) return save;
  const nextEquipment = { ...equipment };
  delete nextEquipment[slot];
  return {
    ...save,
    ownedPals: save.ownedPals.map((entry) =>
      entry.uid === palUid ? { ...entry, equipment: nextEquipment } : entry
    ),
  };
}

/** Cleans equipment slots that reference items no longer owned. */
export function sanitizeInstanceEquipment(save: GameSave): GameSave {
  const ownedUids = new Set(save.inventory.equipment.map((item) => item.uid));
  const ownedPals = save.ownedPals.map((instance) => {
    const equipment = { ...(instance.equipment ?? {}) };
    for (const slot of SLOTS) {
      const uid = equipment[slot];
      if (uid && !ownedUids.has(uid)) delete equipment[slot];
    }
    return { ...instance, equipment };
  });
  return { ...save, ownedPals };
}

export function getEquipmentSlotLabel(slot: EquipmentSlot): string {
  return slot === "core" ? "核心" : slot === "charm" ? "护符" : "护甲";
}

export function getEquipmentRarityLabel(rarity: EquipmentRarity): string {
  return rarity === "common" ? "基础" : rarity === "rare" ? "稀有" : "传说";
}
