const jwt = require("jsonwebtoken");
const { isCredentialedOrigin } = require("../lib/origins");

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const isProduction = process.env.NODE_ENV === "production";

// Üretimde __Host- öneki tarayıcıya şunu zorunlu kılar: Secure, Path=/ ve
// Domain özniteliği yok. Böylece cookie başka bir alt alan adından
// yazılamaz ve yalnızca HTTPS üzerinden gönderilir.
const SESSION_COOKIE_NAME = isProduction ? "__Host-islik_session" : "islik_session";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (typeof secret === "string" && secret.trim().length > 0) {
    return secret;
  }

  if (isProduction) {
    throw new Error("JWT_SECRET must be set in production.");
  }

  return "local-dev-secret";
}

function assertJwtSecret() {
  getJwtSecret();
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    getJwtSecret(),
    {
      expiresIn: SESSION_TTL_SECONDS
    }
  );
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/"
  };
}

// Web istemcisi cookie oturumu istediğini özel bir başlıkla bildirir. Özel
// başlık, başka bir sitenin tarayıcıya bu isteği "basit istek" olarak
// gönderdirmesini engeller (CORS ön kontrolü gerekir); böylece saldırgan
// kurbanı kendi hesabına giriş yaptıramaz (login CSRF).
function wantsCookieSession(req) {
  return String(req.get("X-Auth-Mode") || "").toLowerCase() === "cookie";
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions(),
    maxAge: SESSION_TTL_SECONDS * 1000
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
}

function readCookie(req, name) {
  const header = req.headers.cookie;

  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() !== name) {
      continue;
    }
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

function extractCredentials(req) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type === "Bearer" && token) {
    return { token, source: "bearer" };
  }

  const cookieToken = readCookie(req, SESSION_COOKIE_NAME);
  return cookieToken ? { token: cookieToken, source: "cookie" } : { token: null, source: null };
}

// Tarayıcı cookie'yi her isteğe kendiliğinden ekler; bu yüzden cookie ile
// doğrulanan durum değiştirici bir isteğin gerçekten bizim web uygulamamızdan
// geldiği kanıtlanmalıdır (CSRF). Modern tarayıcılar POST/PUT/DELETE
// isteklerine Origin başlığını her zaman ekler. Bearer token tarayıcı
// tarafından otomatik gönderilmediği için bu kontrole ihtiyaç duymaz.
function isTrustedCookieRequest(req) {
  return SAFE_METHODS.has(req.method) || isCredentialedOrigin(req.get("Origin"));
}

function requireAuth(req, res, next) {
  const { token, source } = extractCredentials(req);

  if (!token) {
    return res.status(401).json({
      error: {
        message: "Authentication required."
      }
    });
  }

  if (source === "cookie" && !isTrustedCookieRequest(req)) {
    return res.status(403).json({
      error: {
        message: "Cross-site request blocked."
      }
    });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());

    req.user = {
      id: payload.sub,
      email: payload.email
    };

    next();
  } catch {
    if (source === "cookie") {
      clearSessionCookie(res);
    }
    return res.status(401).json({
      error: {
        message: "Invalid or expired token."
      }
    });
  }
}

module.exports = {
  SESSION_COOKIE_NAME,
  assertJwtSecret,
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
  signToken,
  wantsCookieSession
};
