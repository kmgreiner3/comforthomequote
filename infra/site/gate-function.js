// CloudFront Function (viewer-request): preview password gate.
// Cookie must equal the sha256 hex of the shared preview password (kept out of the repo).
// Rotate: change HASH, terraform apply.
// Allow-listed paths below must exist as real S3 objects; a missing one would fall
// through to the SPA error fallback and serve app content without the cookie.
var HASH = 'a11e8aa4ae797b57ec625f1e9c407065ead8b92447bb9c17f6181ea6fd518231';

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri === '/gate.html' || uri === '/robots.txt' || uri === '/favicon.png') {
    return request;
  }
  var cookies = request.cookies;
  if (cookies && cookies.chq_preview && cookies.chq_preview.value === HASH) {
    return request;
  }
  return {
    statusCode: 302,
    statusDescription: 'Found',
    headers: { location: { value: '/gate.html' } },
  };
}
