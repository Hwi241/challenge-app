export function previewOrderTop(order, heights, id) {
  'worklet';
  let top = 0;
  for (let index = 0; index < order.length; index += 1) {
    if (order[index] === id) return top;
    top += heights[order[index]] ?? 0;
  }
  return top;
}

export function previewOrderHeight(order, heights) {
  'worklet';
  let height = 0;
  for (let index = 0; index < order.length; index += 1) {
    height += heights[order[index]] ?? 0;
  }
  return height;
}

export function previewOrderAtTop(order, heights, id, top) {
  'worklet';
  const from = order.indexOf(id);
  if (from < 0) return order;
  let to = from;
  let slotTop = previewOrderTop(order, heights, id);
  const hysteresis = 4;
  const nextHeight = heights[order[from + 1]] ?? 0;

  if (
    from < order.length - 1 &&
    top > slotTop + nextHeight / 2 + hysteresis
  ) {
    while (to < order.length - 1) {
      const height = heights[order[to + 1]] ?? 0;
      if (top <= slotTop + height / 2 + hysteresis) break;
      slotTop += height;
      to += 1;
    }
  } else {
    while (to > 0) {
      const height = heights[order[to - 1]] ?? 0;
      if (top >= slotTop - height / 2 - hysteresis) break;
      slotTop -= height;
      to -= 1;
    }
  }

  if (to === from) return order;
  const next = order.slice();
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
