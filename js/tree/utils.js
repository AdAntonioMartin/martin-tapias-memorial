import { SVG_NS } from "./config.js";
import { escapeHtml, setText } from "../core/html.js";
import { normalizeText } from "../core/text.js";
import { normalizeDataPath } from "../core/url.js";
import { parseDateByFormat, normalizeDateFormat } from "../core/dates.js";
import { average } from "../core/collections.js";

export { escapeHtml, setText, normalizeText, normalizeDataPath, parseDateByFormat, normalizeDateFormat, average };

export function svgEl(tag, attrs) {
  var element = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs || {}).forEach(function (key) {
    element.setAttribute(key, attrs[key]);
  });
  return element;
}
