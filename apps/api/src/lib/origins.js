const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

// CORS: originsiz istekler (curl, mobil uygulama) ve izin listesi geçer.
// Geliştirmede liste boşsa her kaynak kabul edilir; bu yalnızca kimlik
// bilgisi taşımayan istekler için geçerlidir (bkz. isCredentialedOrigin).
function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  return !isProduction && allowedOrigins.length === 0;
}

// Cookie ile kimlik doğrulanan isteklere yalnızca açıkça izin verilmiş
// kaynaklardan (veya geliştirmede yerel makineden) izin verilir. "Her kaynağı
// yansıt + credentials" klasik bir CORS hatasıdır; burada asla yapılmaz.
function isCredentialedOrigin(origin) {
  if (!origin) {
    return false;
  }
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  if (isProduction) {
    return false;
  }
  try {
    const { protocol, hostname } = new URL(origin);
    return (protocol === "http:" || protocol === "https:") && LOCAL_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}

module.exports = {
  isCredentialedOrigin,
  isOriginAllowed
};
