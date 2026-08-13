export function normalizeDataPath(value) {
  if (!value) {
    return "";
  }

  let normalized = String(value).replace(/\\/g, "/").trim();
  try {
    const parsed = new URL(normalized, window.location.href);
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
    const url = new URL(value, window.location.href);
    return url.origin === window.location.origin ? url.pathname + url.search : url.href;
  } catch (error) {
    return value;
  }
}

export function inferTreeKeyFromPath(path) {
  const match = String(path || "").match(/^data\/trees\/([^/]+)\//);
  return match && match[1] ? match[1] : "";
}

export function buildQueryUrl(base, params) {
  const qs = new URLSearchParams();
  Object.keys(params || {}).forEach((key) => {
    if (params[key]) {
      qs.set(key, params[key]);
    }
  });
  return `${base}?${qs.toString()}`;
}
