export function teamSizeLabel(min: number, max: number) {
  return `${min === max ? min : `${min}–${max}`} ${max === 1 ? "member" : "members"}`;
}
