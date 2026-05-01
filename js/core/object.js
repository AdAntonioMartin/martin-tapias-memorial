export function readPathValue(object, path) {
  if (!path) {
    return undefined;
  }

  return String(path).split(".").reduce(function (current, part) {
    if (current && Object.prototype.hasOwnProperty.call(current, part)) {
      return current[part];
    }
    return undefined;
  }, object);
}
