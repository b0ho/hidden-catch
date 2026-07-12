function pad(order: number) {
  return String(order).padStart(2, '0');
}

/** Every stage in a category reuses the same source photo, only the diffs differ. */
export function categoryOriginalSrc(categoryId: string) {
  return `/stages/${categoryId}/original.jpg`;
}

export function stageModifiedSrc(categoryId: string, order: number) {
  return `/stages/${categoryId}/${pad(order)}/modified.jpg`;
}

export function stageMetaSrc(categoryId: string, order: number) {
  return `/stages/${categoryId}/${pad(order)}/meta.json`;
}

/** localStorage/record key and route id for a stage — e.g. "hanok-01". */
export function makeStageId(categoryId: string, order: number) {
  return `${categoryId}-${pad(order)}`;
}
