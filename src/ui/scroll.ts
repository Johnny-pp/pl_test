export function getMinScroll(viewportHeight: number, contentHeight: number, top = 0): number {
  return Math.min(0, viewportHeight - contentHeight - top);
}

export function clampScroll(
  current: number,
  wheelDelta: number,
  viewportHeight: number,
  contentHeight: number,
  top = 0
): number {
  const minimum = getMinScroll(viewportHeight, contentHeight, top);
  return Math.max(minimum, Math.min(0, current - wheelDelta * 0.5));
}
