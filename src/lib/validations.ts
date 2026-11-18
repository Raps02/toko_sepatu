import { z } from 'zod';

// Semua input dari FormData divalidasi di sini sebelum menyentuh Prisma.
// `FormData.get()` mengembalikan null untuk field yang tidak ada dan '' untuk
// field kosong, jadi field opsional dinormalkan dulu ke undefined.

const emptyToUndefined = (value: unknown) => (value === null || value === '' ? undefined : value);

const requiredText = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => (v == null ? '' : v),
    z
      .string({ invalid_type_error: `${label} wajib diisi` })
      .trim()
      .min(min, min <= 1 ? `${label} wajib diisi` : `${label} minimal ${min} karakter`)
      .max(max, `${label} maksimal ${max} karakter`),
  );

const optionalText = (label: string, max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, `${label} maksimal ${max} karakter`).optional());

const money = (label: string, min = 0) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ required_error: `${label} wajib diisi`, invalid_type_error: `${label} harus berupa angka` })
      .int(`${label} harus bilangan bulat`)
      .min(min, `${label} minimal Rp ${min.toLocaleString('id-ID')}`)
      .max(1_000_000_000, `${label} terlalu besar`),
  );

const quantity = (label: string, min = 1, max = 100_000) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ required_error: `${label} wajib diisi`, invalid_type_error: `${label} harus berupa angka` })
      .int(`${label} harus bilangan bulat`)
      .min(min, `${label} minimal ${min}`)
      .max(max, `${label} maksimal ${max}`),
  );

const id = (label: string) => requiredText(label, 1, 40);
const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());
const email = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''),
  z.string().min(1, 'Email wajib diisi').email('Format email tidak valid').max(120),
);
const phone = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(/^[0-9+][0-9\s-]{7,17}$/, 'Nomor HP tidak valid')
    .optional(),
);
const dateKeyField = (label: string) =>
  z.preprocess(emptyToUndefined, z.string({ required_error: `${label} wajib diisi` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} tidak valid`));

// ── Akun ──

export const loginSchema = z.object({
  email,
  password: requiredText('Password', 1, 72),
});

// bcrypt hanya memakai 72 byte pertama, jadi password dibatasi 72 karakter.
const newPassword = requiredText('Password', 8, 72);

/** Nama akun tampil ke orang lain, jadi tidak boleh berisi alamat situs atau email. */
const personName = requiredText('Nama', 2, 80).refine((name) => !/https?:|www\.|@|[a-z0-9-]\.[a-z]{2,}/i.test(name), {
  message: 'Tulis nama tanpa alamat situs atau email',
});

export const registerSchema = z.object({
  name: personName,
  email,
  phone,
  password: newPassword,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: requiredText('Token', 10, 200),
  password: newPassword,
});

/** Kata sandi lama wajib untuk akun yang sudah punya kata sandi; dicek di action. */
const currentPassword = z.preprocess(emptyToUndefined, z.string().max(72).optional());

export const changePasswordSchema = z.object({
  currentPassword,
  password: newPassword,
});

export const changeEmailSchema = z.object({
  email,
  /** Kata sandi saat ini (nama berbeda dari form ganti kata sandi karena keduanya ada di halaman yang sama). */
  emailPassword: currentPassword,
});

export const confirmEmailChangeSchema = z.object({ token: requiredText('Token', 10, 200) });

export const ROLES = ['ADMIN', 'SPV', 'CUSTOMER'] as const;

export const createUserSchema = z.object({
  name: personName,
  email,
  phone,
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Role tidak valid' }) }),
  password: newPassword,
});

export const updateUserSchema = z.object({
  id: id('User'),
  name: personName,
  email,
  phone,
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Role tidak valid' }) }),
  isActive: checkbox,
  // Kosongkan untuk tidak mengganti password.
  password: z.preprocess(emptyToUndefined, z.string().min(8, 'Password minimal 8 karakter').max(72).optional()),
});

export const profileSchema = z.object({
  name: personName,
  phone,
});

export const addressSchema = z.object({
  label: requiredText('Label alamat', 1, 30),
  recipient: requiredText('Nama penerima', 2, 80),
  phone: z.preprocess(
    (v) => (v == null ? '' : v),
    z.string().trim().regex(/^[0-9+][0-9\s-]{7,17}$/, 'Nomor HP tidak valid'),
  ),
  street: requiredText('Alamat', 5, 200),
  city: requiredText('Kota', 2, 60),
  province: requiredText('Provinsi', 2, 60),
  postalCode: z.preprocess((v) => (v == null ? '' : v), z.string().trim().regex(/^\d{5}$/, 'Kode pos harus 5 angka')),
});

// ── Katalog ──

export const categorySchema = z.object({
  name: requiredText('Nama kategori', 2, 40),
});

export const GENDERS = ['PRIA', 'WANITA', 'UNISEX'] as const;

const productFields = {
  name: requiredText('Nama produk', 3, 120),
  brand: requiredText('Merek', 1, 60),
  gender: z.preprocess(
    (v) => (v == null || v === '' ? 'UNISEX' : v),
    z.enum(GENDERS, { errorMap: () => ({ message: 'Pilih untuk pria, wanita, atau unisex' }) }),
  ),
  description: optionalText('Deskripsi', 2000),
  categoryId: optionalText('Kategori', 40),
  isPublished: checkbox,
};

// Harga modal hanya ada di form admin. Wajib/tidaknya ditentukan di action
// berdasarkan izin `cost.view`, karena form SPV tidak punya isian ini.
const costPrice = money('Harga modal per pasang', 1000).optional();

export const createProductSchema = z.object({
  ...productFields,
  basePrice: money('Harga', 1000),
  costPrice,
});

// Harga jual tidak ikut diubah di sini; perubahan harga punya alur sendiri.
export const updateProductSchema = z.object({
  id: id('Produk'),
  ...productFields,
  costPrice,
});

export const variantSchema = z.object({
  productId: id('Produk'),
  size: requiredText('Ukuran', 1, 10),
  color: requiredText('Warna', 1, 40),
  sku: optionalText('SKU', 40),
});

// ── Stok ──

export const stockInSchema = z.object({
  variantId: id('Varian'),
  quantity: quantity('Jumlah'),
  note: optionalText('Catatan', 200),
});

export const stockOutSchema = z.object({
  variantId: id('Varian'),
  quantity: quantity('Jumlah'),
  note: requiredText('Alasan barang keluar', 3, 200),
});

export const stockCorrectionSchema = z.object({
  variantId: id('Varian'),
  actualStock: quantity('Stok sebenarnya', 0),
  reason: requiredText('Alasan koreksi', 5, 300),
});

const STOCK_MOVEMENT_TYPES = ['IN', 'OUT', 'SALE', 'RESTOCK', 'ADJUSTMENT'] as const;

/** Filter tabel riwayat stok dari query string. Nilai yang tidak valid diabaikan, bukan ditolak. */
export const stockMovementFilterSchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(60).optional()).catch(undefined),
  type: z.preprocess(emptyToUndefined, z.enum(STOCK_MOVEMENT_TYPES).optional()).catch(undefined),
  product: z.preprocess(emptyToUndefined, z.string().max(40).optional()).catch(undefined),
  by: z.preprocess(emptyToUndefined, z.string().max(40).optional()).catch(undefined),
  from: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()).catch(undefined),
  to: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()).catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type StockMovementFilter = z.infer<typeof stockMovementFilterSchema>;

// ── Harga & diskon ──

export const priceChangeSchema = z.object({
  productId: id('Produk'),
  newPrice: money('Harga baru', 1000),
  reason: requiredText('Alasan', 5, 300),
});

export const DISCOUNT_TYPES = ['PERCENT', 'FIXED'] as const;

export const discountSchema = z
  .object({
    productId: id('Produk'),
    type: z.enum(DISCOUNT_TYPES, { errorMap: () => ({ message: 'Jenis diskon tidak valid' }) }),
    value: quantity('Nilai diskon', 1, 1_000_000_000),
    startsAt: dateKeyField('Tanggal mulai'),
    endsAt: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal selesai tidak valid').optional()),
    reason: requiredText('Alasan', 5, 300),
  })
  .refine((d) => d.type !== 'PERCENT' || d.value <= 90, {
    path: ['value'],
    message: 'Diskon persen maksimal 90%',
  })
  .refine((d) => !d.endsAt || d.endsAt >= d.startsAt, {
    path: ['endsAt'],
    message: 'Tanggal selesai tidak boleh sebelum tanggal mulai',
  });

export const reviewChangeSchema = z.object({
  id: id('Pengajuan'),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: optionalText('Catatan', 300),
});

// Bentuk `ChangeRequest.payload` per jenis pengajuan. Diperiksa ulang saat
// pengajuan disetujui, karena isinya berasal dari kolom Json.
export const priceChangePayload = z.object({
  productId: z.string(),
  oldPrice: z.number().int(),
  newPrice: z.number().int().min(1000),
});

export const discountPayload = z.object({
  productId: z.string(),
  type: z.enum(DISCOUNT_TYPES),
  value: z.number().int().min(1),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
});

export const stockCorrectionPayload = z.object({
  variantId: z.string(),
  recordedStock: z.number().int(),
  actualStock: z.number().int().min(0),
});

export const orderCorrectionPayload = z.object({
  orderId: z.string(),
  courier: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  oldCourier: z.string().nullable(),
  oldTrackingNumber: z.string().nullable(),
});

// ── Keranjang & order ──

export const addToCartSchema = z.object({
  variantId: id('Ukuran'),
  quantity: quantity('Jumlah', 1, 10),
});

export const updateCartSchema = z.object({
  cartItemId: id('Item'),
  quantity: quantity('Jumlah', 0, 10),
});

export const checkoutSchema = z
  .object({
    addressId: id('Alamat pengiriman'),
    note: optionalText('Catatan', 200),
    // "Beli Sekarang": checkout satu varian ini saja, keranjang tidak disentuh.
    buyVariantId: optionalText('Sepatu', 40),
    buyQuantity: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(10).optional()),
  })
  .refine((d) => !d.buyVariantId || d.buyQuantity !== undefined, {
    path: ['buyQuantity'],
    message: 'Jumlah wajib diisi',
  });

export const changeCartVariantSchema = z.object({
  cartItemId: id('Item'),
  variantId: id('Ukuran'),
});

export const shipOrderSchema = z.object({
  orderId: id('Order'),
  courier: requiredText('Kurir', 2, 40),
  trackingNumber: requiredText('Nomor resi', 4, 60),
});

export const orderCorrectionSchema = z.object({
  orderId: id('Order'),
  courier: requiredText('Kurir', 2, 40),
  trackingNumber: requiredText('Nomor resi', 4, 60),
  reason: requiredText('Alasan koreksi', 5, 300),
});

export const shippingRateSchema = z.object({
  province: requiredText('Provinsi', 2, 60),
  cost: money('Ongkir', 0),
});

// ── Review, retur, chat ──

export const reviewSchema = z.object({
  orderItemId: id('Barang'),
  rating: quantity('Rating', 1, 5),
  comment: optionalText('Ulasan', 1000),
});

export const reviewReplySchema = z.object({
  reviewId: id('Review'),
  reply: requiredText('Balasan', 2, 1000),
});

export const returnRequestSchema = z.object({
  orderItemId: id('Barang'),
  quantity: quantity('Jumlah', 1, 100),
  reason: requiredText('Alasan pengembalian', 10, 1000),
});

export const handleReturnSchema = z.object({
  returnId: id('Retur'),
  decision: z.enum(['APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED']),
  handlerNote: optionalText('Catatan', 300),
});

export const messageSchema = z.object({
  body: requiredText('Pesan', 1, 1000),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
