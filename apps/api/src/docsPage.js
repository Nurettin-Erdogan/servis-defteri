// /docs: OpenAPI sözleşmesini Redoc ile gösteren salt okunur sayfa.
//
// Redoc sürüme sabitlenmiş tek bir dosyadan yüklenir ve Subresource Integrity ile
// doğrulanır; dosya CDN'de değişirse tarayıcı çalıştırmayı reddeder. Sayfanın CSP'si
// betiği yalnızca bu tam URL'ye kilitler. Redoc API'ye istek atmaz ("try it out"
// yoktur); yalnızca /openapi.json'u okur.

const REDOC_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/redoc@2.5.0/bundles/redoc.standalone.js";
const REDOC_SCRIPT_INTEGRITY =
  "sha384-4vOjrBu7SuDWXcAw1qFznVLA/sKL+0l4nn+J1HY8w7cpa6twQEYuh4b0Cwuo7CyX";

const DOCS_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  `script-src ${REDOC_SCRIPT_URL}`,
  // Redoc stillerini çalışma anında ekler (styled-components).
  "style-src 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  // Arama dizini blob: URL'li bir web worker'da çalışır.
  "worker-src blob:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join("; ");

const docsHtml = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Servis Defteri API</title>
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <redoc spec-url="/openapi.json"></redoc>
    <script src="${REDOC_SCRIPT_URL}" integrity="${REDOC_SCRIPT_INTEGRITY}" crossorigin="anonymous"></script>
  </body>
</html>
`;

module.exports = {
  DOCS_CONTENT_SECURITY_POLICY,
  REDOC_SCRIPT_INTEGRITY,
  REDOC_SCRIPT_URL,
  docsHtml
};
