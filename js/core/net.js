function fetchChecked(path, errorMessage) {
  return fetch(path).then((response) => {
    if (!response.ok) {
      throw new Error(errorMessage || `No se pudo cargar ${path}`);
    }
    return response;
  });
}

export function fetchJson(path, errorMessage) {
  return fetchChecked(path, errorMessage).then((response) => response.json());
}

export function fetchText(path, errorMessage) {
  return fetchChecked(path, errorMessage).then((response) => response.text());
}
