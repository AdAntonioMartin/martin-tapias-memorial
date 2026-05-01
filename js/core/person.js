import { normalizeText } from "./text.js";
import { readPathValue } from "./object.js";

export function getFactValue(recordOrFacts, label) {
  var facts = Array.isArray(recordOrFacts)
    ? recordOrFacts
    : (recordOrFacts && Array.isArray(recordOrFacts.facts) ? recordOrFacts.facts : []);
  var targetLabel = normalizeText(label);

  for (var i = 0; i < facts.length; i += 1) {
    if (normalizeText(facts[i].label) === targetLabel) {
      return facts[i].value || "";
    }
  }

  return "";
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
