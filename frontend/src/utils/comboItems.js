/** Posti di una combo: prodotti fissi e gruppi di alternative (stessa choice_group) fra cui si sceglie. */
export function comboSlots(combo) {
  const slots = []
  const groups = new Map()
  for (const item of combo?.items || []) {
    if (item.choice_group) {
      if (!groups.has(item.choice_group)) {
        const slot = { group: item.choice_group, quantity: Number(item.quantity), items: [] }
        groups.set(item.choice_group, slot)
        slots.push(slot)
      }
      groups.get(item.choice_group).items.push(item)
    } else {
      slots.push({ group: null, quantity: Number(item.quantity), items: [item] })
    }
  }
  return slots
}

export const comboHasChoices = (combo) => comboSlots(combo).some((slot) => slot.group)

/** Es. "1× Pizza + 1× Pepsi Twist / Coca-Cola / Birra a scelta" */
export function comboLabel(combo) {
  return comboSlots(combo)
    .map((slot) => (slot.group
      ? `${slot.quantity}× ${slot.items.map((item) => item.product?.name).join(' / ')} a scelta`
      : `${slot.quantity}× ${slot.items[0].product?.name}`))
    .join(' + ')
}
