import type { GameSave } from "../player/playerState.ts";
import { canPayResources, payResources } from "./baseLayout.ts";
import type { ResourceId } from "./baseSystem.ts";

export interface BaseOrderDef {
  id: string;
  title: string;
  description: string;
  cost: Partial<Record<ResourceId, number>>;
  rewardLabel: string;
  rewards: {
    coins?: number;
    advancedCaptureOrbs?: number;
    healingTonics?: number;
    captureOrbs?: number;
    materials?: Record<string, number>;
    equipment?: string[];
  };
}

export const BASE_ORDERS: BaseOrderDef[] = [
  {
    id: "order-haven-supply",
    title: "芦灯港补给",
    description: "向芦灯港交付一批建材，换取星币报酬。",
    cost: { stone: 15, metal: 2 },
    rewardLabel: "星币 120",
    rewards: { coins: 120 },
  },
  {
    id: "order-orb-contract",
    title: "器械回收",
    description: "回收金属与晶体，制成高级捕获器并换取报酬。",
    cost: { metal: 3, crystal: 2 },
    rewardLabel: "高级捕获器 1、星币 40",
    rewards: { advancedCaptureOrbs: 1, coins: 40 },
  },
  {
    id: "order-herb-stock",
    title: "药草备货",
    description: "为疗愈师备齐药草与食物，换取治疗剂。",
    cost: { food: 20, fiber: 10 },
    rewardLabel: "治疗剂 2、星币 50",
    rewards: { healingTonics: 2, coins: 50 },
  },
  {
    id: "order-forge-commission",
    title: "铸甲委托",
    description: "熔炼并装配一批强化护甲，酬劳丰厚。",
    cost: { metal: 4, fiber: 12 },
    rewardLabel: "星币 180、稀有护甲",
    rewards: { coins: 180, equipment: ["armor-reinforced-mail"] },
  },
];

export const baseOrdersById = new Map(BASE_ORDERS.map((order) => [order.id, order]));

export function getOrderClaimed(save: GameSave, orderId: string): number {
  return save.base.orders.find((entry) => entry.id === orderId)?.claimedCount ?? 0;
}

export function canCompleteOrder(save: GameSave, order: BaseOrderDef): boolean {
  return canPayResources(save.base.resources, order.cost);
}

export function completeOrder(save: GameSave, orderId: string): GameSave {
  const order = baseOrdersById.get(orderId);
  if (!order) return save;
  if (!canCompleteOrder(save, order)) return save;
  const claimedCount = getOrderClaimed(save, order.id) + 1;
  const rewards = order.rewards;
  const materials = { ...save.inventory.materials };
  for (const [name, amount] of Object.entries(rewards.materials ?? {})) {
    materials[name] = (materials[name] ?? 0) + (amount ?? 0);
  }
  const orders = save.base.orders.some((entry) => entry.id === order.id)
    ? save.base.orders.map((entry) => (entry.id === order.id ? { ...entry, claimedCount } : entry))
    : [...save.base.orders, { id: order.id, claimedCount }];
  return {
    ...save,
    base: {
      ...save.base,
      resources: payResources(save.base.resources, order.cost),
      orders,
    },
    inventory: {
      ...save.inventory,
      coins: save.inventory.coins + (rewards.coins ?? 0),
      advancedCaptureOrbs: save.inventory.advancedCaptureOrbs + (rewards.advancedCaptureOrbs ?? 0),
      healingTonics: save.inventory.healingTonics + (rewards.healingTonics ?? 0),
      captureOrbs: save.inventory.captureOrbs + (rewards.captureOrbs ?? 0),
      materials,
      equipment: [
        ...save.inventory.equipment,
        ...(rewards.equipment ?? []).map((equipmentId) => ({
          uid: `order-${order.id}-${claimedCount}-${equipmentId}`,
          equipmentId,
        })),
      ],
    },
  };
}
