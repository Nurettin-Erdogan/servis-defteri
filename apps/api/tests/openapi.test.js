// OpenAPI sözleşme testi: src/openapi.js'deki belgeyi koda bağlar.
//
// 1. Koddaki her rota belgelenmiştir; belgelenen her işlem koddadır.
// 2. Bütün şemalar katı modda derlenir ve her $ref çözülür.
// 3. Uçtan uca bir akışta dönen her gerçek yanıtın durum kodu belgelenmiştir ve
//    gövdesi şemaya birebir uyar (additionalProperties: false). Belgelenen her
//    başarılı yanıt akışta en az bir kez üretilir.

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const { app, routeMounts } = require("../src/app");
const { prisma } = require("../src/lib/prisma");
const { openApiDocument } = require("../src/openapi");
const { REDOC_SCRIPT_INTEGRITY, REDOC_SCRIPT_URL } = require("../src/docsPage");

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

// --- Rota kapsamı -----------------------------------------------------------

const toOpenApiPath = (path) => path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");

function routesOf(stack, prefix = "") {
  return stack
    .filter((layer) => layer.route)
    .flatMap((layer) => {
      const path = toOpenApiPath(prefix + (layer.route.path === "/" && prefix ? "" : layer.route.path));
      return Object.keys(layer.route.methods)
        .filter((method) => HTTP_METHODS.includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`);
    });
}

function implementedOperations() {
  return [
    ...routesOf(app.router.stack),
    ...routeMounts.flatMap((mount) => routesOf(mount.router.stack, mount.path))
  ].sort();
}

function documentedOperations() {
  return Object.entries(openApiDocument.paths)
    .flatMap(([path, item]) =>
      HTTP_METHODS.filter((method) => item[method]).map((method) => `${method.toUpperCase()} ${path}`)
    )
    .sort();
}

test("koddaki her rota belgelenmiş, belgelenen her işlem kodda var", () => {
  const implemented = implementedOperations();
  assert.ok(implemented.length >= 20, `Rotalar okunamadı: ${implemented.join(", ")}`);
  assert.deepEqual(documentedOperations(), implemented);
});

// --- Şemalar ----------------------------------------------------------------

// Bileşen şemaları Ajv'ye tek bir belge olarak eklenir; OpenAPI'deki
// #/components/schemas/X referansları spec#/$defs/X'e çevrilir.
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
// OpenAPI 3.1, şemalarda tekil `example`a izin verir; Redoc örnek istekleri bundan üretir.
ajv.addKeyword("example");
ajv.addSchema({
  $id: "spec",
  $defs: JSON.parse(
    JSON.stringify(openApiDocument.components.schemas).replaceAll(
      '"#/components/schemas/',
      '"spec#/$defs/'
    )
  )
});

const validators = new Map();
function validatorFor(schemaRef) {
  const target = schemaRef.replace("#/components/schemas/", "spec#/$defs/");
  if (!validators.has(target)) {
    validators.set(target, ajv.compile({ $ref: target }));
  }
  return validators.get(target);
}

function eachOperation(callback) {
  for (const [path, item] of Object.entries(openApiDocument.paths)) {
    for (const method of HTTP_METHODS.filter((name) => item[name])) {
      callback(path, method, item[method]);
    }
  }
}

test("bütün şemalar katı modda derlenir ve JSON yanıtları bileşen şemalarına başvurur", () => {
  for (const name of Object.keys(openApiDocument.components.schemas)) {
    assert.doesNotThrow(() => validatorFor(`#/components/schemas/${name}`), name);
  }

  eachOperation((path, method, operation) => {
    assert.ok(operation.operationId, `${method} ${path}: operationId yok`);
    for (const [status, response] of Object.entries(operation.responses)) {
      const schema = response.content?.["application/json"]?.schema;
      if (schema && path !== "/openapi.json") {
        assert.match(schema.$ref ?? "", /^#\/components\/schemas\//, `${method} ${path} ${status}`);
      }
    }
  });
});

// --- Uçtan uca akış ---------------------------------------------------------

const exercised = new Set();

function expectDocumented(response, method, path) {
  const operation = openApiDocument.paths[path]?.[method];
  assert.ok(operation, `${method.toUpperCase()} ${path} belgelenmemiş`);

  const documented = operation.responses[String(response.status)];
  assert.ok(
    documented,
    `${method.toUpperCase()} ${path} → ${response.status} belgelenmemiş. Gövde: ${JSON.stringify(response.body)}`
  );
  exercised.add(`${method} ${path} ${response.status}`);

  const schema = documented.content?.["application/json"]?.schema;
  if (!schema) {
    if (!documented.content) {
      assert.equal(response.text || "", "", `${method.toUpperCase()} ${path} → ${response.status} gövde döndürmemeli`);
    }
    return response;
  }
  if (!schema.$ref) {
    return response;
  }

  const validate = validatorFor(schema.$ref);
  assert.ok(
    validate(response.body),
    `${method.toUpperCase()} ${path} → ${response.status} şemaya uymuyor: ${ajv.errorsText(validate.errors)}\n` +
      JSON.stringify(response.body, null, 2)
  );
  return response;
}

async function resetDatabase() {
  const databaseUrl = process.env.DATABASE_URL || "";
  assert.ok(databaseUrl.includes("schema=islik_test"), "Testler yalnızca islik_test şemasında çalışır.");
  await prisma.job.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
}

test.before(resetDatabase);
test.after(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

test("uçtan uca akıştaki her yanıt sözleşmeye uyar", async () => {
  const api = request(app);
  const futureAppointment = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const photo = { name: "ariza.png", type: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgo=" };

  // Sistem
  expectDocumented(await api.get("/health"), "get", "/health");
  expectDocumented(await api.get("/ready"), "get", "/ready");

  const spec = expectDocumented(await api.get("/openapi.json"), "get", "/openapi.json");
  assert.deepEqual(spec.body, JSON.parse(JSON.stringify(openApiDocument)));

  const docs = expectDocumented(await api.get("/docs"), "get", "/docs");
  assert.match(docs.headers["content-type"], /^text\/html/);
  assert.ok(docs.text.includes(`integrity="${REDOC_SCRIPT_INTEGRITY}"`), "Redoc betiği SRI olmadan yükleniyor");
  const csp = docs.headers["content-security-policy"];
  assert.ok(csp.includes(`script-src ${REDOC_SCRIPT_URL}`), "CSP betiği tam URL'ye kilitlemiyor");
  assert.ok(csp.includes("default-src 'none'") && csp.includes("frame-ancestors 'none'"));

  // Kimlik doğrulama
  const account = { name: "Ayşe Usta", email: "ayse@example.com", password: "guclu-parola-123" };
  const registered = expectDocumented(
    await api.post("/api/auth/register").send(account),
    "post",
    "/api/auth/register"
  );
  assert.equal(registered.status, 201);
  const authorization = `Bearer ${registered.body.data.token}`;

  assert.equal(expectDocumented(await api.post("/api/auth/register").send(account), "post", "/api/auth/register").status, 409);
  assert.equal(
    expectDocumented(await api.post("/api/auth/register").send({ ...account, email: "gecersiz" }), "post", "/api/auth/register").status,
    400
  );
  assert.equal(
    expectDocumented(await api.post("/api/auth/login").send({ email: account.email, password: account.password }), "post", "/api/auth/login").status,
    200
  );
  assert.equal(
    expectDocumented(await api.post("/api/auth/login").send({ email: account.email, password: "yanlis-parola" }), "post", "/api/auth/login").status,
    401
  );

  const cookieLogin = expectDocumented(
    await api.post("/api/auth/login").set("X-Auth-Mode", "cookie").send({ email: account.email, password: account.password }),
    "post",
    "/api/auth/login"
  );
  assert.equal(cookieLogin.body.data.token, undefined, "Cookie modunda token gövdede dönmemeli");
  const sessionCookie = cookieLogin.headers["set-cookie"][0].split(";")[0];

  assert.equal(expectDocumented(await api.get("/api/auth/me").set("Authorization", authorization), "get", "/api/auth/me").status, 200);
  assert.equal(expectDocumented(await api.get("/api/auth/me"), "get", "/api/auth/me").status, 401);

  // Müşteriler
  const customer = expectDocumented(
    await api.post("/api/customers").set("Authorization", authorization).send({ name: "Mehmet Yılmaz", phone: "05321234567", address: "Kadıköy" }),
    "post",
    "/api/customers"
  );
  assert.equal(customer.status, 201);
  const customerId = customer.body.data.id;

  assert.equal(
    expectDocumented(await api.post("/api/customers").set("Authorization", authorization).send({ name: "A" }), "post", "/api/customers").status,
    400
  );
  assert.equal(
    expectDocumented(
      await api.post("/api/customers").set("Cookie", sessionCookie).set("Origin", "https://saldirgan.example").send({ name: "Sahte Müşteri" }),
      "post",
      "/api/customers"
    ).status,
    403
  );
  assert.equal(expectDocumented(await api.get("/api/customers"), "get", "/api/customers").status, 401);

  const updatedCustomer = expectDocumented(
    await api.put(`/api/customers/${customerId}`).set("Authorization", authorization).send({ note: "Kapı kodu 12" }),
    "put",
    "/api/customers/{id}"
  );
  assert.equal(updatedCustomer.body.data.note, "Kapı kodu 12");
  assert.equal(
    expectDocumented(await api.get("/api/customers/olmayan-musteri").set("Authorization", authorization), "get", "/api/customers/{id}").status,
    404
  );

  // İşler
  const job = expectDocumented(
    await api.post("/api/jobs").set("Authorization", authorization).send({
      customerId,
      title: "Kombi bakımı",
      productCategory: "heating",
      priority: "high",
      price: 1500,
      paymentStatus: "partial",
      paidAmount: 500,
      appointmentAt: futureAppointment,
      photos: [photo]
    }),
    "post",
    "/api/jobs"
  );
  assert.equal(job.status, 201);
  const jobId = job.body.data.id;

  assert.equal(
    expectDocumented(
      await api.post("/api/jobs").set("Authorization", authorization).send({ customerId, title: "Klima", price: 100, paymentStatus: "partial", paidAmount: 100 }),
      "post",
      "/api/jobs"
    ).status,
    400
  );
  assert.equal(
    expectDocumented(await api.post("/api/jobs").set("Authorization", authorization).send({ customerId: "olmayan", title: "Klima" }), "post", "/api/jobs").status,
    400
  );

  const updatedJob = expectDocumented(
    await api.put(`/api/jobs/${jobId}`).set("Authorization", authorization).send({ status: "in_progress" }),
    "put",
    "/api/jobs/{id}"
  );
  assert.deepEqual(updatedJob.body.data.statusEvents.map((event) => event.status), ["pending", "in_progress"]);

  assert.equal(expectDocumented(await api.get("/api/jobs").set("Authorization", authorization), "get", "/api/jobs").status, 200);
  assert.equal(expectDocumented(await api.get(`/api/jobs/${jobId}`).set("Authorization", authorization), "get", "/api/jobs/{id}").status, 200);
  assert.equal(expectDocumented(await api.get("/api/jobs/olmayan-is").set("Authorization", authorization), "get", "/api/jobs/{id}").status, 404);

  assert.equal(expectDocumented(await api.get("/api/customers").set("Authorization", authorization), "get", "/api/customers").status, 200);
  const detail = expectDocumented(await api.get(`/api/customers/${customerId}`).set("Authorization", authorization), "get", "/api/customers/{id}");
  assert.equal(detail.body.data.jobs.length, 1);

  // Müşteri talepleri (üye olmadan)
  const publicRequest = expectDocumented(
    await api.post("/api/public/requests").send({
      name: "Zeynep Kaya",
      phone: "05551234567",
      productCategory: "heating",
      productBrand: "Örnek",
      description: "Kombi su akıtıyor ve basınç sürekli düşüyor.",
      photos: [photo]
    }),
    "post",
    "/api/public/requests"
  );
  assert.equal(publicRequest.status, 201);
  const { requestCode } = publicRequest.body.data;

  assert.equal(
    expectDocumented(await api.post("/api/public/requests").send({ name: "Zeynep Kaya", phone: "05551234567", description: "kısa" }), "post", "/api/public/requests").status,
    400
  );
  const tracked = expectDocumented(
    await api.get(`/api/public/requests/${requestCode.toLowerCase()}`).query({ phone: "05551234567" }),
    "get",
    "/api/public/requests/{requestCode}"
  );
  assert.equal(tracked.body.data.customer.name, "Zeynep Kaya");
  assert.equal(
    expectDocumented(await api.get(`/api/public/requests/${requestCode}`).query({ phone: "05559999999" }), "get", "/api/public/requests/{requestCode}").status,
    404
  );
  assert.equal(
    expectDocumented(await api.get("/api/public/requests/GECERSIZ").query({ phone: "05551234567" }), "get", "/api/public/requests/{requestCode}").status,
    400
  );

  // Silme ve çıkış
  assert.equal(expectDocumented(await api.delete(`/api/jobs/${jobId}`).set("Authorization", authorization), "delete", "/api/jobs/{id}").status, 204);
  assert.equal(expectDocumented(await api.delete(`/api/jobs/${jobId}`).set("Authorization", authorization), "delete", "/api/jobs/{id}").status, 404);
  assert.equal(expectDocumented(await api.delete(`/api/customers/${customerId}`).set("Authorization", authorization), "delete", "/api/customers/{id}").status, 204);
  assert.equal(expectDocumented(await api.post("/api/auth/logout"), "post", "/api/auth/logout").status, 204);

  // Belgelenen her başarılı yanıt akışta en az bir kez üretildi mi?
  const missing = [];
  eachOperation((path, method, operation) => {
    for (const status of Object.keys(operation.responses).filter((code) => code.startsWith("2"))) {
      if (!exercised.has(`${method} ${path} ${status}`)) {
        missing.push(`${method.toUpperCase()} ${path} ${status}`);
      }
    }
  });
  assert.deepEqual(missing, [], "Akışta hiç üretilmeyen başarılı yanıtlar");
});
