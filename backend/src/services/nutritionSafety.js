function normalizeRestriction(value) {
  return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function containsRestrictedFood(text, restrictions = []) {
  const answer = normalizeRestriction(text);
  return restrictions.some((restriction) => {
    const normalized = normalizeRestriction(restriction);
    return normalized.length > 0 && answer.includes(normalized);
  });
}

function validateDietPlan(answer, sources, restrictions = []) {
  const text = String(answer || "").trim();
  if (!text || !sources.length || containsRestrictedFood(text, restrictions)) return "";

  const titles = new Set(sources.map((source) => source.title));
  const citations = [...text.matchAll(/\[([^\]]+)\]/g)];
  if (!citations.length || citations.some((citation) => !titles.has(citation[1].trim()))) {
    return "";
  }
  return text;
}

module.exports = { containsRestrictedFood, validateDietPlan };
