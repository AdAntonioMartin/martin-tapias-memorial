import { getFactValue } from "../core/person.js";

function extractYear(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const slash = text.match(/\/(\d{4})$/);
  if (slash) {
    return slash[1];
  }
  const plain = text.match(/\b(\d{4})\b/);
  return plain ? plain[1] : "";
}

export function formatYears(record) {
  if (!record) {
    return "";
  }
  const born = getFactValue(record, "Nacimiento") || record.born || "";
  const died = getFactValue(record, "Fallecimiento") || record.died || "";
  const bornYear = extractYear(born);
  const diedYear = extractYear(died);
  if (!bornYear && !diedYear) {
    return "";
  }
  if (bornYear && diedYear) {
    return `${bornYear} - ${diedYear}`;
  }
  return bornYear ? `n. ${bornYear}` : `+ ${diedYear}`;
}
