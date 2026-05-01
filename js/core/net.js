export function fetchJson(path, errorMessage) {
  return fetch(path).then(function (response) {
    if (!response.ok) {
      throw new Error(errorMessage || ("No se pudo cargar " + path));
    }
    return response.json();
  });
}

export function fetchText(path, errorMessage) {
  return fetch(path).then(function (response) {
    if (!response.ok) {
      throw new Error(errorMessage || ("No se pudo cargar " + path));
    }
    return response.text();
  });
}
