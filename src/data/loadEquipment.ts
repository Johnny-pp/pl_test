import equipmentJson from "../../data/equipment.json";
import type { EquipmentDefinition } from "../types/skillTree";

export const equipmentDefinitions = equipmentJson as EquipmentDefinition[];

export const equipmentDefinitionsById = new Map(
  equipmentDefinitions.map((definition) => [definition.id, definition])
);

export function getEquipmentForSlot(slot: EquipmentDefinition["slot"]): EquipmentDefinition[] {
  return equipmentDefinitions.filter((definition) => definition.slot === slot);
}
