export function normalizeDateFormat(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function parseDateByFormat(value, format) {
  const text = String(value || "").trim();
  const pattern = normalizeDateFormat(format);
  if (!text || !pattern) {
    return NaN;
  }

  const formatParts = pattern.split(/[^a-z]/).filter(Boolean);
  const valueParts = text.split(/[^0-9]/).filter(Boolean);
  if (formatParts.length !== valueParts.length) {
    return NaN;
  }

  let day = NaN;
  let month = NaN;
  let year = NaN;

  for (let i = 0; i < formatParts.length; i += 1) {
    const token = formatParts[i];
    const parsed = parseInt(valueParts[i], 10);
    if (Number.isNaN(parsed)) {
      return NaN;
    }

    if (token === "d" || token === "dd") {
      day = parsed;
    } else if (token === "m" || token === "mm") {
      month = parsed;
    } else if (token === "yyyy") {
      year = parsed;
    } else if (token === "yy") {
      year = parsed + (parsed >= 70 ? 1900 : 2000);
    } else {
      return NaN;
    }
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return NaN;
  }

  return date.getTime();
}

export function parseNumberLoose(value) {
  if (typeof value === "number") {
    return value;
  }

  let text = String(value || "")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/[^0-9,.\-]/g, "");

  if (!text) {
    return NaN;
  }

  if (text.indexOf(",") !== -1 && text.indexOf(".") !== -1) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.indexOf(",") !== -1) {
    text = text.replace(",", ".");
  }

  return Number(text);
}
