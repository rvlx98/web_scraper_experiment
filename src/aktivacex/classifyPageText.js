function hasSuccessfulGreeting(t) {
  const lower = t.normalize("NFC").toLocaleLowerCase("cs-CZ");
  return lower.includes("dobrý den") || lower.includes("dobré odpoledne");
}

/**
 * Classifies page body text for aktivacex URL checks.
 * @param {string} text
 * @returns {'unauthorized' | 'welcome' | 'other'}
 */
export function classifyPageText(text) {
  if (!text || typeof text !== "string") return "other";
  const t = text.normalize("NFC");
  if (t.includes("Neoprávněný přístup")) return "unauthorized";
  if (hasSuccessfulGreeting(t)) return "welcome";
  return "other";
}

export const CLASS_LABELS = {
  unauthorized: "Neoprávněný přístup",
  welcome: "Dobrý den / Dobré odpoledne",
  other: "Nerozpoznáno / jiný obsah"
};
