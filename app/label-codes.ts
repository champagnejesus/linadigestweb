const LABEL_CODE_PATTERN = /^LD-(\d{3,18})$/i;

export function formatLabelCode(id: number) {
  return `LD-${String(id).padStart(3, "0")}`;
}

export function parseLabelCode(value: string) {
  const match = LABEL_CODE_PATTERN.exec(value.trim());
  if (!match) return null;

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
