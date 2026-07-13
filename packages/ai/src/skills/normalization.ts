export const SKILL_ALIASES: Record<string, string> = {
  reactjs: "react",
  "react js": "react",
  "react.js": "react",
  nodejs: "node",
  "node js": "node",
  "node.js": "node",
  nextjs: "next",
  "next js": "next",
  "next.js": "next",
  postgres: "postgresql",
  tailwind: "tailwind css",
  tailwindcss: "tailwind css",
};

export function normalizeSkillText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[._/\\-]+/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ");
}

export function skillDisplayValue(value: string): string {
  const parts = value.split(":");
  return (parts.length > 1 ? parts.slice(1).join(":") : value).trim();
}

export function normalizeSkill(value: string): string {
  const normalized = normalizeSkillText(skillDisplayValue(value));
  const compact = normalized.replace(/\s+/g, "");
  return SKILL_ALIASES[normalized] ?? SKILL_ALIASES[compact] ?? normalized;
}

export function skillsMatch(a: string, b: string): boolean {
  return normalizeSkill(a) === normalizeSkill(b);
}

export function splitSkillItems(value: string): string[] {
  const displayValue = skillDisplayValue(value);
  const items: string[] = [];
  let current = "";
  let parenDepth = 0;

  for (const char of displayValue) {
    if (char === "(" || char === "[" || char === "{") parenDepth += 1;
    if (char === ")" || char === "]" || char === "}") parenDepth = Math.max(0, parenDepth - 1);

    if (parenDepth === 0 && /[,;|\u2022]/.test(char)) {
      const item = current.trim();
      if (item) items.push(item);
      current = "";
    } else {
      current += char;
    }
  }

  const item = current.trim();
  if (item) items.push(item);
  return items;
}

export function uniqueSkillsByNormalization(
  skills: string[],
  options: { preserveCategories?: boolean } = {},
): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const skill of skills) {
    const key = options.preserveCategories
      ? normalizeCategorizedSkillKey(skill)
      : normalizeSkill(skill);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(skill);
  }

  return unique;
}

function normalizeCategorizedSkillKey(value: string): string {
  const parts = value.split(":");
  if (parts.length <= 1) return normalizeSkill(value);

  const category = normalizeSkillText(parts[0]);
  const skill = normalizeSkill(parts.slice(1).join(":"));
  return `${category}:${skill}`;
}

export function createSkillMap(skills: string[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const skill of skills) {
    for (const item of splitSkillItems(skill)) {
      const key = normalizeSkill(item);
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    }
  }

  return map;
}

export function findSkillMentionInItems(
  skill: string,
  items: string[],
): string | null {
  for (const item of items.flatMap(splitSkillItems)) {
    if (normalizedSkillMentioned(skill, item)) {
      return item;
    }
  }

  return null;
}

export function normalizedSkillMentioned(skill: string, text: string): boolean {
  const needle = normalizeSkill(skill);
  if (!needle) return false;

  const haystack = normalizeSkillText(text);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(haystack);
}

