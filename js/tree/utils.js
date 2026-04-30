import { SVG_NS } from "./config.js";

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizeDataPath(value) {
  if (!value) {
    return "";
  }

  var normalized = String(value).replace(/\\/g, "/").trim();
  try {
    var parsed = new URL(normalized, window.location.href);
    normalized = parsed.origin === window.location.origin ? parsed.pathname : parsed.href;
  } catch (error) {
    // Keep raw value.
  }

  return normalized.replace(/^\.\/+/, "").replace(/^\/+/, "");
}

export function svgEl(tag, attrs) {
  var element = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs || {}).forEach(function (key) {
    element.setAttribute(key, attrs[key]);
  });
  return element;
}

export function normalizeDateFormat(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

export function parseDateByFormat(value, format) {
  var text = String(value || "").trim();
  var pattern = normalizeDateFormat(format);
  if (!text || !pattern) {
    return NaN;
  }

  var formatParts = pattern.split(/[^a-z]/).filter(Boolean);
  var valueParts = text.split(/[^0-9]/).filter(Boolean);
  if (formatParts.length !== valueParts.length) {
    return NaN;
  }

  var day = NaN;
  var month = NaN;
  var year = NaN;

  for (var i = 0; i < formatParts.length; i += 1) {
    var token = formatParts[i];
    var parsed = parseInt(valueParts[i], 10);
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

  var date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return NaN;
  }

  return date.getTime();
}

export function average(values) {
  if (!values.length) {
    return NaN;
  }
  var sum = values.reduce(function (acc, value) { return acc + value; }, 0);
  return sum / values.length;
}
