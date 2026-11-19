// Servis Defteri API'sinin OpenAPI 3.1 sözleşmesi. /openapi.json'dan sunulur,
// /docs'ta Redoc ile gösterilir.
//
// tests/openapi.test.js bu belgeyi koda bağlar:
//   1. Koddaki her rota burada belgelenmiştir; burada belgelenen her işlem koddadır.
//   2. Uçtan uca bir akışta dönen her gerçek yanıtın durum kodu belgelenmiştir ve
//      gövdesi şemaya birebir uyar. Yanıt şemaları additionalProperties: false
//      kullanır; kod belgelenmemiş bir alan döndürürse test kırılır.
//
// Şemalar JSON Schema 2020-12 ile uyumludur (OpenAPI 3.1); testte doğrudan Ajv ile
// derlenir.

const { version } = require("../package.json");
const {
  JOB_PRIORITIES,
  JOB_SOURCES,
  JOB_STATUSES,
  MAX_JOB_PHOTOS,
  MAX_PHOTO_DATA_URL_LENGTH,
  PAYMENT_STATUSES,
  PRODUCT_CATEGORIES
} = require("./lib/jobFields");

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

// Yanıt nesneleri: bütün alanlar zorunlu, belgelenmemiş alana izin yok.
const responseObject = (properties) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties
});

// İstek gövdeleri: sunucu bilinmeyen alanları yok sayar.
const requestObject = (properties, required = []) => ({
  type: "object",
  ...(required.length ? { required } : {}),
  properties
});

const dataEnvelope = (schema) => responseObject({ data: schema });

const id = { type: "string", minLength: 1, example: "cm3k9x2ab0001qz8f6yhd1a2b" };
const dateTime = { type: "string", format: "date-time" };
const nullableDateTime = { type: ["string", "null"], format: "date-time" };
const nullableString = { type: ["string", "null"] };
const money = { type: "number", minimum: 0, maximum: 1000000000 };
const phone = {
  type: "string",
  pattern: "^\\d{10,15}$",
  description: "Yalnızca rakam, 10-15 hane.",
  example: "05321234567"
};
const requestCode = { type: "string", pattern: "^SD-\\d{6}$", example: "SD-482913" };
const personName = (description, example) => ({
  type: "string",
  minLength: 2,
  maxLength: 80,
  pattern: "^[^0-9]*$",
  description,
  example
});
const optionalText = (maxLength, example) => ({
  type: ["string", "null"],
  maxLength,
  ...(example ? { example } : {})
});
const email = { type: "string", format: "email", maxLength: 254, example: "usta@example.com" };

const customerProperties = {
  id,
  userId: { type: ["string", "null"] },
  name: { type: "string" },
  phone: nullableString,
  address: nullableString,
  note: nullableString,
  createdAt: dateTime,
  updatedAt: dateTime
};

const jobProperties = {
  id,
  customerId: id,
  requestCode: { ...requestCode, type: ["string", "null"] },
  source: { type: "string", enum: JOB_SOURCES },
  productCategory: { type: ["string", "null"], enum: [...PRODUCT_CATEGORIES, null] },
  productBrand: nullableString,
  productModel: nullableString,
  title: { type: "string" },
  description: nullableString,
  status: { type: "string", enum: JOB_STATUSES },
  priority: { type: "string", enum: JOB_PRIORITIES },
  price: money,
  paidAmount: money,
  paymentStatus: { type: "string", enum: PAYMENT_STATUSES },
  appointmentAt: nullableDateTime,
  photos: { type: "array", maxItems: MAX_JOB_PHOTOS, items: ref("Photo") },
  createdAt: dateTime,
  updatedAt: dateTime
};

const photoInput = requestObject(
  {
    id: { type: "string", maxLength: 80 },
    name: { type: "string", maxLength: 80 },
    type: { type: "string", maxLength: 50, example: "image/jpeg" },
    dataUrl: {
      type: "string",
      pattern: "^data:image/(png|jpe?g|webp);base64,",
      maxLength: MAX_PHOTO_DATA_URL_LENGTH,
      description: "Cihazda sıkıştırılmış PNG, JPEG ya da WebP data URL'i."
    }
  },
  ["dataUrl"]
);

const jobInputProperties = {
  customerId: { type: "string", minLength: 1, maxLength: 64, example: "cm3k9x2ab0001qz8f6yhd1a2b" },
  title: { type: "string", minLength: 2, maxLength: 120, example: "Kombi bakımı" },
  description: optionalText(2000, "Yıllık bakım; basınç kontrol edilecek."),
  productCategory: { type: "string", enum: PRODUCT_CATEGORIES, default: "other" },
  productBrand: optionalText(80, "Örnek Marka"),
  productModel: optionalText(80, "X200"),
  photos: { type: "array", maxItems: MAX_JOB_PHOTOS, items: photoInput },
  status: { type: "string", enum: JOB_STATUSES, default: "pending" },
  priority: { type: "string", enum: JOB_PRIORITIES, default: "normal" },
  price: { ...money, default: 0 },
  paidAmount: {
    ...money,
    default: 0,
    description:
      "Yalnızca paymentStatus = partial iken anlamlıdır ve 0 < paidAmount < price olmalıdır. unpaid için 0'a, paid için price'a eşitlenir."
  },
  paymentStatus: { type: "string", enum: PAYMENT_STATUSES, default: "unpaid" },
  appointmentAt: {
    ...nullableDateTime,
    description: "Geçmiş bir tarih olamaz (güncellemede mevcut değer korunabilir)."
  }
};

const schemas = {
  Error: responseObject({
    error: responseObject({ message: { type: "string", example: "Customer not found." } })
  }),
  Health: responseObject({
    status: { const: "ok" },
    service: { const: "islik-cloud-api" },
    revision: {
      type: "string",
      pattern: "^([0-9a-f]{7,64}|local)$",
      description: "Canlıda çalışan git commit'i; dağıtımın eski sürümde takılı kalmadığını doğrulamak için."
    }
  }),
  Ready: responseObject({
    status: { const: "ready" },
    service: { const: "islik-cloud-api" },
    revision: { type: "string", pattern: "^([0-9a-f]{7,64}|local)$" }
  }),
  User: responseObject({
    id,
    name: nullableString,
    email: { type: "string", format: "email" },
    createdAt: dateTime,
    updatedAt: dateTime
  }),
  Session: dataEnvelope({
    type: "object",
    additionalProperties: false,
    required: ["user"],
    properties: {
      user: ref("User"),
      token: {
        type: "string",
        description:
          "JWT (7 gün). Yalnızca bearer modunda döner; X-Auth-Mode: cookie isteğinde token yalnızca httpOnly cookie'ye yazılır ve gövdede yer almaz."
      }
    }
  }),
  UserResponse: dataEnvelope(responseObject({ user: ref("User") })),
  Customer: responseObject(customerProperties),
  CustomerListItem: responseObject({
    ...customerProperties,
    _count: responseObject({ jobs: { type: "integer", minimum: 0 } })
  }),
  CustomerDetail: responseObject({
    ...customerProperties,
    jobs: { type: "array", items: ref("Job") }
  }),
  CustomerResponse: dataEnvelope(ref("Customer")),
  CustomerDetailResponse: dataEnvelope(ref("CustomerDetail")),
  CustomerListResponse: dataEnvelope({ type: "array", items: ref("CustomerListItem") }),
  Photo: responseObject({
    id: { type: "string" },
    name: { type: "string" },
    type: { type: "string" },
    dataUrl: { type: "string" }
  }),
  JobStatusEvent: responseObject({
    id,
    jobId: id,
    status: { type: "string", enum: JOB_STATUSES },
    actor: { type: "string", example: "technician", description: "Değişikliği yapan: technician, customer ya da system." },
    note: nullableString,
    createdAt: dateTime
  }),
  Job: responseObject(jobProperties),
  JobWithRelations: responseObject({
    ...jobProperties,
    customer: ref("Customer"),
    statusEvents: { type: "array", items: ref("JobStatusEvent") }
  }),
  JobResponse: dataEnvelope(ref("JobWithRelations")),
  JobListResponse: dataEnvelope({ type: "array", items: ref("JobWithRelations") }),
  PublicJob: responseObject({
    id,
    requestCode,
    productCategory: { type: ["string", "null"], enum: [...PRODUCT_CATEGORIES, null] },
    productCategoryLabel: { type: "string", example: "Kombi / Isıtma" },
    productBrand: nullableString,
    productModel: nullableString,
    title: { type: "string" },
    description: nullableString,
    status: { type: "string", enum: JOB_STATUSES },
    priority: { type: "string", enum: JOB_PRIORITIES },
    price: money,
    paidAmount: money,
    paymentStatus: { type: "string", enum: PAYMENT_STATUSES },
    appointmentAt: nullableDateTime,
    photos: { type: "array", items: ref("Photo") },
    createdAt: dateTime,
    statusHistory: {
      type: "array",
      items: responseObject({
        id,
        status: { type: "string", enum: JOB_STATUSES },
        actor: { type: "string" },
        note: nullableString,
        createdAt: dateTime
      })
    },
    customer: responseObject({ name: { type: "string" } })
  }),
  PublicJobResponse: dataEnvelope(ref("PublicJob")),
  RegisterRequest: requestObject(
    {
      name: personName("Usta adı; rakam içeremez.", "Ayşe Usta"),
      email,
      password: { type: "string", minLength: 8, maxLength: 128, example: "guclu-parola-123" }
    },
    ["name", "email", "password"]
  ),
  LoginRequest: requestObject(
    {
      email,
      password: { type: "string", minLength: 1, maxLength: 128, example: "guclu-parola-123" }
    },
    ["email", "password"]
  ),
  CustomerCreate: requestObject(
    {
      name: personName("Müşteri adı; rakam içeremez.", "Mehmet Yılmaz"),
      phone: { ...phone, type: ["string", "null"] },
      address: optionalText(250, "Kadıköy, İstanbul"),
      note: optionalText(1000, "Kapı kodu 12")
    },
    ["name"]
  ),
  CustomerUpdate: requestObject({
    name: personName("Müşteri adı; rakam içeremez.", "Mehmet Yılmaz"),
    phone: { ...phone, type: ["string", "null"] },
    address: optionalText(250, "Kadıköy, İstanbul"),
    note: optionalText(1000, "Kapı kodu 12")
  }),
  JobCreate: requestObject(jobInputProperties, ["customerId", "title"]),
  JobUpdate: requestObject(jobInputProperties),
  PublicRequestCreate: requestObject(
    {
      name: personName("Müşteri adı; rakam içeremez.", "Mehmet Yılmaz"),
      phone,
      address: optionalText(250, "Kadıköy, İstanbul"),
      productCategory: { type: "string", enum: PRODUCT_CATEGORIES, default: "other" },
      productBrand: optionalText(80, "Örnek Marka"),
      productModel: optionalText(80, "X200"),
      description: { type: "string", minLength: 10, maxLength: 2000, example: "Kombi su akıtıyor ve basınç sürekli düşüyor." },
      photos: { type: "array", maxItems: MAX_JOB_PHOTOS, items: photoInput }
    },
    ["name", "phone", "description"]
  )
};

const json = (schemaName) => ({ "application/json": { schema: ref(schemaName) } });
const ok = (description, schemaName) => ({ description, content: json(schemaName) });
const error = (description) => ({ description, content: json("Error") });
const noContent = (description) => ({ description });
const body = (schemaName) => ({ required: true, content: json(schemaName) });

const idParameter = (description) => ({
  name: "id",
  in: "path",
  required: true,
  description,
  schema: { type: "string" }
});

const errors = {
  validation: error("Doğrulama hatası; mesaj hangi alanın geçersiz olduğunu söyler."),
  unauthorized: error("Oturum yok ya da token geçersiz/süresi dolmuş."),
  csrf: error("Cookie ile doğrulanan değiştirici istek izinli bir Origin'den gelmedi (CSRF koruması)."),
  rateLimited: {
    ...error("Bu IP için istek sınırı aşıldı."),
    headers: {
      "Retry-After": { description: "Saniye cinsinden bekleme süresi.", schema: { type: "integer" } }
    }
  },
  tooLarge: error("İstek gövdesi 4 MB'ı aşıyor."),
  customerNotFound: error("Müşteri yok ya da oturumdaki ustaya ait değil."),
  jobNotFound: error("İş yok ya da oturumdaki ustaya ait değil.")
};

const authenticated = [{ bearerAuth: [] }, { cookieAuth: [] }];

const paths = {
  "/health": {
    get: {
      tags: ["Sistem"],
      summary: "Servis sağlığı ve çalışan sürüm",
      description: "Veritabanına dokunmaz; servisin ayakta olduğunu ve hangi commit'i çalıştırdığını söyler.",
      operationId: "getHealth",
      security: [],
      responses: { 200: ok("Servis ayakta.", "Health") }
    }
  },
  "/ready": {
    get: {
      tags: ["Sistem"],
      summary: "Veritabanı hazırlığı",
      operationId: "getReadiness",
      security: [],
      responses: {
        200: ok("Servis ve veritabanı hazır.", "Ready"),
        503: error("Veritabanına ulaşılamıyor.")
      }
    }
  },
  "/api/auth/register": {
    post: {
      tags: ["Kimlik doğrulama"],
      summary: "Usta hesabı oluştur",
      operationId: "register",
      security: [],
      parameters: [{ $ref: "#/components/parameters/AuthMode" }],
      requestBody: body("RegisterRequest"),
      responses: {
        201: ok("Hesap oluşturuldu ve oturum açıldı.", "Session"),
        400: errors.validation,
        409: error("E-posta zaten kayıtlı."),
        429: errors.rateLimited
      }
    }
  },
  "/api/auth/login": {
    post: {
      tags: ["Kimlik doğrulama"],
      summary: "Oturum aç",
      description:
        "Hatalı e-posta ve hatalı parola aynı yanıtı verir; hangi hesapların kayıtlı olduğu sızdırılmaz.",
      operationId: "login",
      security: [],
      parameters: [{ $ref: "#/components/parameters/AuthMode" }],
      requestBody: body("LoginRequest"),
      responses: {
        200: ok("Oturum açıldı.", "Session"),
        401: error("E-posta ya da parola hatalı."),
        429: errors.rateLimited
      }
    }
  },
  "/api/auth/logout": {
    post: {
      tags: ["Kimlik doğrulama"],
      summary: "Oturumu kapat",
      description: "Cookie oturumunu siler. Bearer token istemcide silinmelidir.",
      operationId: "logout",
      security: [],
      responses: { 204: noContent("Oturum kapatıldı."), 429: errors.rateLimited }
    }
  },
  "/api/auth/me": {
    get: {
      tags: ["Kimlik doğrulama"],
      summary: "Oturumdaki usta",
      operationId: "getCurrentUser",
      security: authenticated,
      responses: {
        200: ok("Oturumdaki kullanıcı.", "UserResponse"),
        401: errors.unauthorized,
        404: error("Token geçerli ama kullanıcı silinmiş."),
        429: errors.rateLimited
      }
    }
  },
  "/api/customers": {
    get: {
      tags: ["Müşteriler"],
      summary: "Müşterileri listele",
      description: "Yalnızca oturumdaki ustanın müşterileri, yeniden eskiye; her biri iş sayısıyla.",
      operationId: "listCustomers",
      security: authenticated,
      responses: { 200: ok("Müşteriler.", "CustomerListResponse"), 401: errors.unauthorized }
    },
    post: {
      tags: ["Müşteriler"],
      summary: "Müşteri ekle",
      operationId: "createCustomer",
      security: authenticated,
      requestBody: body("CustomerCreate"),
      responses: {
        201: ok("Müşteri oluşturuldu.", "CustomerResponse"),
        400: errors.validation,
        401: errors.unauthorized,
        403: errors.csrf
      }
    }
  },
  "/api/customers/{id}": {
    parameters: [idParameter("Müşteri kimliği.")],
    get: {
      tags: ["Müşteriler"],
      summary: "Müşteri ve işleri",
      operationId: "getCustomer",
      security: authenticated,
      responses: {
        200: ok("Müşteri ve işleri (yeniden eskiye).", "CustomerDetailResponse"),
        401: errors.unauthorized,
        404: errors.customerNotFound
      }
    },
    put: {
      tags: ["Müşteriler"],
      summary: "Müşteriyi güncelle",
      description: "Yalnızca gönderilen alanlar değişir.",
      operationId: "updateCustomer",
      security: authenticated,
      requestBody: body("CustomerUpdate"),
      responses: {
        200: ok("Güncellenmiş müşteri.", "CustomerResponse"),
        400: errors.validation,
        401: errors.unauthorized,
        403: errors.csrf,
        404: errors.customerNotFound
      }
    },
    delete: {
      tags: ["Müşteriler"],
      summary: "Müşteriyi sil",
      description: "Müşterinin bütün işleri de silinir.",
      operationId: "deleteCustomer",
      security: authenticated,
      responses: {
        204: noContent("Silindi."),
        401: errors.unauthorized,
        403: errors.csrf,
        404: errors.customerNotFound
      }
    }
  },
  "/api/jobs": {
    get: {
      tags: ["İşler"],
      summary: "İşleri listele",
      description: "Oturumdaki ustanın müşterilerine ait bütün işler, yeniden eskiye; müşteri ve durum geçmişiyle.",
      operationId: "listJobs",
      security: authenticated,
      responses: { 200: ok("İşler.", "JobListResponse"), 401: errors.unauthorized }
    },
    post: {
      tags: ["İşler"],
      summary: "İş oluştur",
      description: "İşe benzersiz bir takip kodu (SD-######) atanır ve ilk durum olayı kaydedilir.",
      operationId: "createJob",
      security: authenticated,
      requestBody: body("JobCreate"),
      responses: {
        201: ok("İş oluşturuldu.", "JobResponse"),
        400: error("Doğrulama hatası ya da customerId oturumdaki ustanın bir müşterisi değil (\"Related customer was not found.\")."),
        401: errors.unauthorized,
        403: errors.csrf,
        413: errors.tooLarge
      }
    }
  },
  "/api/jobs/{id}": {
    parameters: [idParameter("İş kimliği.")],
    get: {
      tags: ["İşler"],
      summary: "İş ayrıntısı",
      operationId: "getJob",
      security: authenticated,
      responses: {
        200: ok("İş, müşterisi ve durum geçmişi.", "JobResponse"),
        401: errors.unauthorized,
        404: errors.jobNotFound
      }
    },
    put: {
      tags: ["İşler"],
      summary: "İşi güncelle",
      description: "Yalnızca gönderilen alanlar değişir. Durum değişikliği durum geçmişine yeni bir olay ekler.",
      operationId: "updateJob",
      security: authenticated,
      requestBody: body("JobUpdate"),
      responses: {
        200: ok("Güncellenmiş iş.", "JobResponse"),
        400: error("Doğrulama hatası ya da yeni customerId oturumdaki ustanın bir müşterisi değil."),
        401: errors.unauthorized,
        403: errors.csrf,
        404: errors.jobNotFound,
        413: errors.tooLarge
      }
    },
    delete: {
      tags: ["İşler"],
      summary: "İşi sil",
      operationId: "deleteJob",
      security: authenticated,
      responses: {
        204: noContent("Silindi."),
        401: errors.unauthorized,
        403: errors.csrf,
        404: errors.jobNotFound
      }
    }
  },
  "/api/public/requests": {
    post: {
      tags: ["Müşteri talepleri"],
      summary: "Üye olmadan servis talebi aç",
      description:
        "Talep hizmet sahibinin hesabına (PUBLIC_SERVICE_OWNER_EMAIL) atanır. Aynı telefonla daha önce talep açan müşteri yeniden kullanılır. Yanıttaki takip kodu ve telefon, talebin durumunu sorgulamak için gerekir.",
      operationId: "createPublicRequest",
      security: [],
      requestBody: body("PublicRequestCreate"),
      responses: {
        201: ok("Talep oluşturuldu.", "PublicJobResponse"),
        400: errors.validation,
        413: errors.tooLarge,
        429: errors.rateLimited,
        503: error("Hizmet sahibi hesabı henüz hazır değil.")
      }
    }
  },
  "/api/public/requests/{requestCode}": {
    get: {
      tags: ["Müşteri talepleri"],
      summary: "Talebin durumunu sorgula",
      description:
        "Takip kodu tek başına yetmez; talebi açan telefon numarası da eşleşmelidir. Yanıt, müşteriye yalnızca adını gösterir.",
      operationId: "getPublicRequest",
      security: [],
      parameters: [
        {
          name: "requestCode",
          in: "path",
          required: true,
          description: "Takip kodu (büyük/küçük harf duyarsız).",
          schema: requestCode
        },
        {
          name: "phone",
          in: "query",
          required: true,
          description: "Talebi açarken kullanılan telefon.",
          schema: phone
        }
      ],
      responses: {
        200: ok("Talep ve durum geçmişi.", "PublicJobResponse"),
        400: errors.validation,
        404: error("Bu kod ve telefonla eşleşen talep yok."),
        429: errors.rateLimited
      }
    }
  },
  "/openapi.json": {
    get: {
      tags: ["Sistem"],
      summary: "Bu sözleşme (OpenAPI 3.1)",
      operationId: "getOpenApiDocument",
      security: [],
      responses: {
        200: {
          description: "OpenAPI belgesi.",
          content: { "application/json": { schema: { type: "object" } } }
        }
      }
    }
  },
  "/docs": {
    get: {
      tags: ["Sistem"],
      summary: "İnsan okunur API dokümantasyonu (Redoc)",
      operationId: "getDocs",
      security: [],
      responses: {
        200: { description: "HTML sayfa.", content: { "text/html": { schema: { type: "string" } } } }
      }
    }
  }
};

const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Servis Defteri API",
    version,
    summary: "Küçük servis işletmeleri için müşteri, iş ve servis talebi yönetimi.",
    description: [
      "Web (React) ve mobil (Expo) istemcilerin ortak REST API'si.",
      "",
      "**Kimlik doğrulama.** Mobil istemci `Authorization: Bearer <token>` kullanır. Web istemcisi `X-Auth-Mode: cookie` ile oturum açarsa token yalnızca `HttpOnly; SameSite=Strict` cookie'ye yazılır; cookie ile doğrulanan değiştirici istekler yalnızca izinli `Origin`'den kabul edilir.",
      "",
      "**Kiracı izolasyonu.** Her usta yalnızca kendi müşterilerini ve işlerini görür; başkasına ait bir kayıt `404` döner.",
      "",
      "**Hata biçimi.** Bütün hatalar `{ \"error\": { \"message\": \"...\" } }` biçimindedir.",
      "",
      "**Rate limit.** `/api/auth` ve `/api/public/requests` altındaki istekler IP başına sınırlıdır; aşıldığında `429` ve `Retry-After` döner."
    ].join("\n"),
    license: { name: "MIT", identifier: "MIT" }
  },
  servers: [
    { url: "https://islik-cloud-api.onrender.com", description: "Canlı (ücretsiz plan; ilk istek 20-60 sn sürebilir)" },
    { url: "http://localhost:4000", description: "Yerel geliştirme" }
  ],
  tags: [
    { name: "Kimlik doğrulama" },
    { name: "Müşteriler" },
    { name: "İşler" },
    { name: "Müşteri talepleri", description: "Üye olmadan kullanılan, müşteriye açık uçlar." },
    { name: "Sistem" }
  ],
  paths,
  components: {
    schemas,
    parameters: {
      AuthMode: {
        name: "X-Auth-Mode",
        in: "header",
        required: false,
        description: "`cookie` verilirse token gövdede dönmez, httpOnly cookie'ye yazılır (web istemcisi).",
        schema: { type: "string", enum: ["cookie", "bearer"] }
      }
    },
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "__Host-islik_session",
        description: "Web istemcisinin httpOnly oturum cookie'si (yerelde adı islik_session)."
      }
    }
  }
};

module.exports = {
  openApiDocument
};
