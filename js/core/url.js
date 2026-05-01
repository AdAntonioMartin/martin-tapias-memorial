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

export function resolveHref(baseUrl, href) {
  try {
    return new URL(href, baseUrl).href;
  } catch (error) {
    return "";
  }
}

export function toPathOrUrl(value) {
  try {
    var url = new URL(value, window.location.href);
    return url.origin === window.location.origin ? (url.pathname + url.search) : url.href;
  } catch (error) {
    return value;
  }
}
