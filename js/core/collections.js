export function unique(values) {
  return values.filter(function (value, index) {
    return values.indexOf(value) === index;
  });
}

export function average(values) {
  if (!values || !values.length) {
    return NaN;
  }
  var sum = values.reduce(function (acc, value) { return acc + value; }, 0);
  return sum / values.length;
}
