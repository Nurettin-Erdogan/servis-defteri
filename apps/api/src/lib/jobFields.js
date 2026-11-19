// İş kayıtlarının izin verilen değerleri için tek kaynak. Rotalar doğrulamada,
// src/openapi.js ise API sözleşmesinde aynı listeleri kullanır; böylece belge
// koddan sapamaz.

const JOB_STATUSES = ["pending", "in_progress", "completed", "cancelled"];
const JOB_PRIORITIES = ["low", "normal", "high", "urgent"];
const PAYMENT_STATUSES = ["unpaid", "partial", "paid"];
const JOB_SOURCES = ["technician", "customer"];
const PRODUCT_CATEGORIES = [
  "heating",
  "cooling",
  "white_goods",
  "electronics",
  "computer",
  "phone",
  "other"
];

const MAX_JOB_PHOTOS = 3;
const MAX_PHOTO_DATA_URL_LENGTH = 950000;
const PHOTO_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,/i;

module.exports = {
  JOB_PRIORITIES,
  JOB_SOURCES,
  JOB_STATUSES,
  MAX_JOB_PHOTOS,
  MAX_PHOTO_DATA_URL_LENGTH,
  PAYMENT_STATUSES,
  PHOTO_DATA_URL_PATTERN,
  PRODUCT_CATEGORIES
};
