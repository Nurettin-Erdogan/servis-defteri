# Servis Defteri

<p align="center">
  <a href="https://github.com/Nurettin-Erdogan/servis-defteri/actions/workflows/api-ci.yml"><img src="https://github.com/Nurettin-Erdogan/servis-defteri/actions/workflows/api-ci.yml/badge.svg?branch=main" alt="API CI"></a>
  <a href="https://github.com/Nurettin-Erdogan/servis-defteri/actions/workflows/web-ci.yml"><img src="https://github.com/Nurettin-Erdogan/servis-defteri/actions/workflows/web-ci.yml/badge.svg?branch=main" alt="Web CI"></a>
  <a href="https://github.com/Nurettin-Erdogan/servis-defteri/actions/workflows/mobile-ci.yml"><img src="https://github.com/Nurettin-Erdogan/servis-defteri/actions/workflows/mobile-ci.yml/badge.svg?branch=main" alt="Mobil CI"></a>
  <a href="https://github.com/Nurettin-Erdogan/servis-defteri/actions/workflows/codeql.yml"><img src="https://github.com/Nurettin-Erdogan/servis-defteri/actions/workflows/codeql.yml/badge.svg?branch=main" alt="CodeQL"></a>
  <a href="https://github.com/Nurettin-Erdogan/servis-defteri/actions/workflows/production-smoke.yml"><img src="https://github.com/Nurettin-Erdogan/servis-defteri/actions/workflows/production-smoke.yml/badge.svg?branch=main" alt="Canlı sistem kontrolü"></a>
  <a href="https://islik-cloud.vercel.app/"><img src="https://img.shields.io/badge/live-Vercel-0f766e.svg" alt="Canlı web"></a>
  <img src="https://img.shields.io/badge/mobile-Expo%201.2.1-0f766e.svg" alt="Expo 1.2.1">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0f766e.svg" alt="MIT License"></a>
</p>

**Servis talebinden ödemeye kadar tüm süreci tek yerde yöneten web + mobil + API ürünü.**

Servis Defteri, küçük servis işletmelerinin müşteri, randevu, servis talebi, iş durumu ve ödeme süreçlerini tek akışta toplar. Müşteri hesap açmadan servis talebi oluşturabilir ve takip koduyla durumunu izleyebilir; usta tarafında ise müşteri, iş ve ödeme yönetimi yapılabilir.

<p align="center">
  <a href="https://islik-cloud.vercel.app/"><strong>Canlı uygulamayı aç →</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/demo-guide.md"><strong>Demo rehberi</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/"><strong>Teknik belgeler</strong></a>
  &nbsp;·&nbsp;
  <a href="#testler"><strong>Testler</strong></a>
</p>

<p align="center">
  <img src="docs/screenshots/customer-request.png" alt="Servis Defteri müşteri servis talebi ekranı" width="1000">
</p>

## Kısa özet

| | |
| --- | --- |
| **Problem** | Küçük servis işletmelerinde müşteri, randevu, iş emri ve ödeme takibinin farklı kanallara dağılması |
| **Çözüm** | Aynı iş akışını web, mobil ve API üzerinde birleştiren uçtan uca servis yönetimi ürünü |
| **Web** | React, Vite, PWA |
| **Mobil** | Expo, SecureStore |
| **API** | Node.js, Express, Prisma, JWT |
| **Veritabanı** | PostgreSQL |
| **Güvenlik** | JWT, bcrypt, CORS allowlist, rate limiting, tenant izolasyonu |
| **DevOps** | GitHub Actions, Vercel, Render, EAS |

## Neler yapıyor?

### Müşteri tarafı

- Üye olmadan servis talebi oluşturma
- Kategori, marka, model, adres ve arıza açıklaması girme
- En fazla üç arıza fotoğrafı yükleme ve istemci tarafında sıkıştırma
- Takip kodu + telefon ile servis durumunu görüntüleme

### Usta tarafı

- Kayıt ve giriş
- Bugün, açık, acil, ödeme ve tamamlanan işler için panolar
- Müşteri ve servis talebi CRUD işlemleri
- Arama ve CSV dışa aktarma
- Ödeme durumlarını `ödenmedi / kısmi / ödendi` olarak takip etme

### Mobil dayanıklılık

- Oturum token'ını `expo-secure-store` ile saklama
- Yerel liste önbelleği
- LAN API algılama
- Bağlantı koptuğunda yeniden deneme akışı

## Mimari

```text
Müşteri / Usta
      │
      ├── Web: React + Vite PWA
      │
      └── Mobil: Expo
              │
              ▼
        Express REST API
              │
      ┌───────┴────────┐
      │                │
   Prisma           JWT/Auth
      │
      ▼
 PostgreSQL
```

Proje yapısı:

```text
apps/
├── api/      Express + Prisma REST API
├── web/      React + Vite PWA
└── mobile/   Expo mobil uygulama

docs/         demo ve teknik belgeler
```

## Mühendislik kararları

- **Tek backend, çoklu istemci:** Web ve mobil aynı API'yi kullanır; iş kuralları istemciler arasında dağılmaz.
- **Tenant izolasyonu:** Kullanıcıya ait müşteri ve servis kayıtları API katmanında kullanıcı bazlı sınırlandırılır.
- **Mobil oturum güvenliği:** Mobil token, düz depolama yerine SecureStore üzerinden saklanır.
- **Fotoğraf maliyeti:** Arıza fotoğrafları yükleme öncesinde sıkıştırılarak ağ ve depolama maliyeti azaltılır.
- **Bağlantı sorunları:** Mobil tarafta yerel önbellek ve yeniden deneme akışları bulunur.
- **Ayrı CI kapıları:** API, web ve mobil uygulama için ayrı GitHub Actions kontrolleri çalışır.

## Güvenlik

- JWT tabanlı kimlik doğrulama
- `bcrypt` ile parola hashleme (`cost 12`)
- CORS allowlist
- Auth ve public endpointler için rate limiting
- Güvenlik başlıkları
- Kullanıcı bazlı tenant izolasyonu
- Mobilde Keychain / Keystore tabanlı `expo-secure-store`

### Web oturumu: httpOnly cookie modu

API iki oturum biçimini birlikte destekler:

| İstemci | Token nerede? | Koruma |
| --- | --- | --- |
| Mobil (Expo) | Gövdede döner, cihazda `SecureStore` | Tarayıcı otomatik göndermediği için CSRF'e açık değildir |
| Web, `cookie` modu | Yalnızca `HttpOnly; SameSite=Strict` cookie'de; üretimde `__Host-` önekli ve `Secure` | JavaScript token'ı göremez (XSS token çalamaz); cookie ile doğrulanan değiştirici istekler yalnızca izinli `Origin`'den kabul edilir (CSRF); cookie yalnızca `X-Auth-Mode: cookie` başlığıyla verilir (login CSRF) |
| Web, `bearer` modu | `localStorage` | Eski davranış |

Cookie modu gerçek tarayıcıda uçtan uca doğrulandı: kayıttan sonra `document.cookie` ve `localStorage` token içermiyor, sayfa yenilenince oturum sürüyor, çıkışta cookie siliniyor ve `/api/auth/me` 401 dönüyor.

**Canlı web şu an `bearer` modundadır.** Web (`vercel.app`) ve API (`onrender.com`) farklı sitelerdir; API'nin koyacağı cookie Safari'de üçüncü taraf cookie olarak engellenir. Geçiş, web'in API'ye kendi alan adı üzerinden proxy ile ulaşmasını ve rate limit anahtarının buna göre ayarlanmasını gerektirir. Adımlar ve riskler: [docs/deploy-checklist.md](docs/deploy-checklist.md#31-httponly-cookie-oturumuna-geçiş-hazır-canlıda-henüz-kapalı).

Ortam değişkenleri için örnek yapılandırma `apps/api/.env.example` dosyasındadır. Production secret'ları repoya eklenmemelidir.

## Bilinen sınırlar

- **Tek kullanıcılı hesap modeli:** Her usta hesabı yalnızca kendi müşteri ve iş kayıtlarını görür. İşletme/çalışma alanı, birden fazla çalışan ve rol-yetki modeli henüz yoktur.
- **Müşteri talepleri tek hizmet sahibine düşer:** Üye olmadan açılan talepler `PUBLIC_SERVICE_OWNER_EMAIL` hesabına atanır (tanımlı değilse demo hesabına, o da yoksa ilk kayıtlı kullanıcıya). Ürün, birden çok işletmeyi barındıran bir pazar yeri değildir.
- **Fotoğraflar veritabanında tutulur:** Arıza fotoğrafları iş kaydının JSON alanında base64 olarak saklanır (iş başına en fazla 3, her biri yaklaşık 950 KB sınırlı). Büyük ölçekte nesne depolamaya (S3 vb.) taşınmalıdır.
- **Rate limit süreç içi bellektedir:** Sunucu yeniden başlayınca sayaçlar sıfırlanır ve birden fazla API örneği arasında paylaşılmaz.
- **Bildirim gönderilmez:** Müşteri durum değişikliğini takip kodu ve telefonla kendisi kontrol eder. E-posta veya SMS yoktur.
- **Ödeme yalnızca takip edilir:** `ödenmedi / kısmi / ödendi` durumu kaydedilir; kart veya online ödeme alma entegrasyonu yoktur.
- **Canlı ortam ücretsiz plandadır:** Render API uykuya geçebilir, ilk istek 20–60 saniye sürebilir. Canlı web `bearer` oturum modundadır; cookie modu hazırdır ancak henüz açılmamıştır.

## Canlı sistem

- Web: https://islik-cloud.vercel.app
- API: https://islik-cloud-api.onrender.com
- Health: https://islik-cloud-api.onrender.com/health
- Readiness: https://islik-cloud-api.onrender.com/ready
- **API dokümantasyonu:** https://islik-cloud-api.onrender.com/docs ([OpenAPI 3.1 belgesi](https://islik-cloud-api.onrender.com/openapi.json))

Render ücretsiz planda uykuya geçebildiği için ilk API isteği normalden uzun sürebilir. İstemciler bu duruma karşı daha uzun zaman aşımı ve yeniden deneme davranışı kullanır.

## Yerelde çalıştırma

Gereksinimler:

- Node.js
- Docker Desktop
- PostgreSQL veya Docker Compose ile sağlanan PostgreSQL

Repo kökünden:

```bash
docker compose -p islik-cloud up -d postgres
```

API:

```bash
cd apps/api
cp .env.example .env
npm ci
npx prisma migrate deploy
npm run dev
```

Web:

```bash
cd apps/web
npm ci
npm run dev
```

Windows'ta repo kökündeki `Servis Defteri Baslat.cmd` dosyası yerel geliştirme akışını kolaylaştırmak için kullanılabilir.

## Testler

API, web ve mobil uygulama için ayrı test/CI akışları bulunur.

```bash
cd apps/api && npm test
cd apps/web && npm test
cd apps/mobile && npm test
```

API tarafında Supertest entegrasyon testleri; web ve mobil tarafta istemci testleri CI üzerinde çalıştırılır.

### API sözleşmesi

API'nin OpenAPI 3.1 sözleşmesi [`apps/api/src/openapi.js`](apps/api/src/openapi.js) dosyasındadır; canlıda `/docs` (Redoc) ve `/openapi.json` adreslerinden sunulur. Dokümantasyonun koddan sapmaması bir testle güvenceye alınır ([`tests/openapi.test.js`](apps/api/tests/openapi.test.js)):

- Koddaki her rota belgelenmiştir; belgelenen her işlem koddadır.
- Uçtan uca bir akışta dönen her gerçek yanıtın durum kodu belgelenmiştir ve gövdesi şemaya birebir uyar. Şemalar `additionalProperties: false` kullanır; kod belgelenmemiş bir alan döndürürse CI kırılır.
- Belgelenen her başarılı yanıt akışta en az bir kez üretilir.
- İş durumları, öncelikler ve kategoriler hem doğrulamada hem sözleşmede aynı kaynaktan ([`src/lib/jobFields.js`](apps/api/src/lib/jobFields.js)) okunur.

`/docs` sayfası Redoc'u sürüme sabitlenmiş tek bir dosyadan Subresource Integrity ile yükler; sayfanın Content-Security-Policy'si betiği yalnızca bu URL'ye kilitler. Sayfa salt okunurdur ve API'ye istek atmaz.

## Canlı demo akışı

Canlı uygulamayı hızlı incelemek için:

1. Web uygulamasını aç.
2. Müşteri tarafında yeni servis talebi oluştur.
3. Takip kodunu kullanarak talebin durumunu görüntüle.
4. Usta tarafında oturum açarak müşteriyi, talebi ve ödeme durumunu yönet.

Daha ayrıntılı akış için [`docs/demo-guide.md`](docs/demo-guide.md) dosyasına bakılabilir.

## English

**Servis Defteri** is an end-to-end service operations product for small service businesses. Customers can create and track service requests without an account, while technicians manage customers, jobs, appointments and payment states through the same backend.

**Stack:** React + Vite PWA, Expo mobile, Node.js + Express + Prisma API, PostgreSQL, JWT authentication, GitHub Actions, Vercel and Render.

Live app: [islik-cloud.vercel.app](https://islik-cloud.vercel.app/)

## Sürüm

Mobil uygulama: `1.2.1` · Expo

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır. Güvenlik bildirimleri için `SECURITY.md` dosyasına bakılabilir.
