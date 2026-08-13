import { normalizeText } from "./text.js";
import { readPathValue } from "./object.js";

export function getFactValue(record, label) {
  const facts = record && Array.isArray(record.facts) ? record.facts : [];
  const targetLabel = normalizeText(label);
  const match = facts.find((fact) => normalizeText(fact.label) === targetLabel);
  return match ? match.value || "" : "";
}

export function getRecordField(record, source) {
  if (!source) {
    return "";
  }
  if (source.indexOf("fact:") === 0) {
    return getFactValue(record, source.slice(5));
  }
  return readPathValue(record, source);
}
