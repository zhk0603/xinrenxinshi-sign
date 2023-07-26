function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  var angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  var x = centerX + radius * Math.cos(angleInRadians);
  var y = centerY + radius * Math.sin(angleInRadians);

  return { longitude: x, latitude: y };
}

function generateNewCoordinate(centerX, centerY, radius) {
  var angleInDegrees = Math.random() * 360;
  var newPoint = polarToCartesian(centerX, centerY, radius, angleInDegrees);

  return newPoint;
}

module.exports = {
  generateNewCoordinate
}