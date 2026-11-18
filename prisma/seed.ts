import { existsSync } from 'node:fs';
import path from 'node:path';
import { type Gender, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Skrip seed berjalan di luar Next.js, jadi memakai client sendiri.
const prisma = new PrismaClient();

// Akun contoh untuk development. Ganti password-nya sebelum dipakai sungguhan.
const DEMO_PASSWORD = 'password123';

const ACCOUNTS = [
  { email: 'admin@tapak.test', name: 'Admin Toko', role: 'ADMIN' as const },
  { email: 'spv@tapak.test', name: 'Supervisor Toko', role: 'SPV' as const },
  { email: 'customer@tapak.test', name: 'Budi Pembeli', role: 'CUSTOMER' as const },
];

const CATEGORIES = ['Lari', 'Kasual', 'Futsal', 'Formal'];

type SeedProduct = {
  name: string;
  brand: string;
  category: string;
  gender: Gender;
  basePrice: number;
  cost: number;
  description: string;
  colors: string[];
  sizes: string[];
  /** Path di bawah public/. Gambar yang file-nya belum ada dilewati, lalu dipasang saat seed dijalankan lagi. */
  images: string[];
};

const PRODUCTS: SeedProduct[] = [
  {
    name: 'Aero Run 2',
    brand: 'Lintas',
    category: 'Lari',
    gender: 'PRIA',
    basePrice: 749000,
    cost: 430000,
    description: 'Sepatu lari harian dengan bantalan empuk dan upper jaring yang cepat kering.',
    colors: ['Hitam', 'Biru Laut'],
    sizes: ['39', '40', '41', '42', '43', '44'],
    images: ['/images/products/aero-run-2-hitam.jpg', '/images/products/aero-run-2-biru-laut.jpg'],
  },
  {
    name: 'Tempo Racer',
    brand: 'Lintas',
    category: 'Lari',
    gender: 'PRIA',
    basePrice: 1199000,
    cost: 690000,
    description: 'Ringan dan responsif untuk latihan cepat dan lomba 10K.',
    colors: ['Putih'],
    sizes: ['40', '41', '42', '43'],
    images: ['/images/products/tempo-racer-putih.jpg'],
  },
  {
    name: 'Kota Low',
    brand: 'Sandar',
    category: 'Kasual',
    gender: 'UNISEX',
    basePrice: 459000,
    cost: 240000,
    description: 'Sneaker kanvas potongan rendah untuk dipakai setiap hari.',
    colors: ['Putih', 'Hitam'],
    sizes: ['37', '38', '39', '40', '41', '42', '43'],
    images: ['/images/products/kota-low-putih.jpg', '/images/products/kota-low-hitam.jpg'],
  },
  {
    name: 'Lapang Pro IC',
    brand: 'Gawang',
    category: 'Futsal',
    gender: 'PRIA',
    basePrice: 529000,
    cost: 300000,
    description: 'Sol karet non-marking untuk lapangan futsal dalam ruangan.',
    colors: ['Hijau', 'Hitam'],
    sizes: ['39', '40', '41', '42', '43'],
    images: ['/images/products/lapang-pro-ic-hijau.jpg', '/images/products/lapang-pro-ic-hitam.jpg'],
  },
  {
    name: 'Derby Kulit',
    brand: 'Pangkat',
    category: 'Formal',
    gender: 'PRIA',
    basePrice: 899000,
    cost: 520000,
    description: 'Pantofel kulit sapi dengan sol jahit, cocok untuk kantor dan acara resmi.',
    colors: ['Cokelat Tua', 'Hitam'],
    sizes: ['39', '40', '41', '42', '43', '44'],
    images: ['/images/products/derby-kulit-cokelat-tua.jpg', '/images/products/derby-kulit-hitam.jpg'],
  },
  {
    name: 'Aero Run 2 Wanita',
    brand: 'Lintas',
    category: 'Lari',
    gender: 'WANITA',
    basePrice: 749000,
    cost: 430000,
    description: 'Versi wanita Aero Run 2: cetakan lebih ramping di tumit dan bagian depan, bantalan sama empuknya.',
    colors: ['Lavender', 'Putih'],
    sizes: ['36', '37', '38', '39', '40'],
    images: ['/images/products/aero-run-2-wanita-lavender.jpg', '/images/products/aero-run-2-wanita-putih.jpg'],
  },
  {
    name: 'Kota Platform',
    brand: 'Sandar',
    category: 'Kasual',
    gender: 'WANITA',
    basePrice: 499000,
    cost: 265000,
    description: 'Sneaker kanvas dengan sol platform 4 cm. Tampak lebih tinggi tanpa pegal seperti hak.',
    colors: ['Putih', 'Krem'],
    sizes: ['35', '36', '37', '38', '39', '40'],
    images: ['/images/products/kota-platform-putih.jpg', '/images/products/kota-platform-krem.jpg'],
  },
  {
    name: 'Senja Flat',
    brand: 'Sandar',
    category: 'Kasual',
    gender: 'WANITA',
    basePrice: 329000,
    cost: 170000,
    description: 'Flat shoes kulit sintetis lembut dengan pita kecil di depan. Ringan untuk kuliah, kerja, atau jalan santai.',
    colors: ['Hitam', 'Nude'],
    sizes: ['36', '37', '38', '39', '40'],
    images: ['/images/products/senja-flat-hitam.jpg', '/images/products/senja-flat-nude.jpg'],
  },
  {
    name: 'Anggun Block Heel',
    brand: 'Pangkat',
    category: 'Formal',
    gender: 'WANITA',
    basePrice: 589000,
    cost: 320000,
    description: 'Pantofel wanita hak balok 5 cm, ujung runcing tipis. Hak lebar bikin stabil dipakai seharian di kantor.',
    colors: ['Hitam', 'Merah Marun'],
    sizes: ['36', '37', '38', '39', '40'],
    images: ['/images/products/anggun-block-heel-hitam.jpg', '/images/products/anggun-block-heel-merah-marun.jpg'],
  },
];

const SHIPPING_RATES: [string, number][] = [
  ['DKI Jakarta', 10000],
  ['Banten', 12000],
  ['Jawa Barat', 12000],
  ['Jawa Tengah', 15000],
  ['DI Yogyakarta', 15000],
  ['Jawa Timur', 17000],
  ['Bali', 22000],
  ['Sumatera Utara', 30000],
  ['Sumatera Selatan', 27000],
  ['Kalimantan Timur', 38000],
  ['Sulawesi Selatan', 38000],
  ['Papua', 65000],
];

const imageExists = (url: string) => existsSync(path.join(process.cwd(), 'public', url));

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  // Seed membuat akun admin dengan password contoh, jadi tidak boleh jalan di production.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed data contoh ditolak di production.');
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const users = await Promise.all(
    ACCOUNTS.map((account) =>
      prisma.user.upsert({
        where: { email: account.email },
        update: {},
        create: { ...account, passwordHash },
      }),
    ),
  );
  const admin = users[0];
  const customer = users[2];

  if ((await prisma.address.count({ where: { userId: customer.id } })) === 0) {
    await prisma.address.create({
      data: {
        userId: customer.id,
        label: 'Rumah',
        recipient: customer.name,
        phone: '081234567890',
        street: 'Jl. Kebon Jeruk No. 12, RT 03/RW 05',
        city: 'Jakarta Barat',
        province: 'DKI Jakarta',
        postalCode: '11530',
        isDefault: true,
      },
    });
  }

  const categories = new Map<string, string>();
  for (const name of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: slug(name) },
      update: {},
      create: { name, slug: slug(name) },
    });
    categories.set(name, category.id);
  }

  for (const [province, cost] of SHIPPING_RATES) {
    await prisma.shippingRate.upsert({ where: { province }, update: {}, create: { province, cost } });
  }

  for (const item of PRODUCTS) {
    const productSlug = slug(item.name);
    let product = await prisma.product.findUnique({
      where: { slug: productSlug },
      include: { images: { select: { url: true } } },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: item.name,
          slug: productSlug,
          brand: item.brand,
          description: item.description,
          basePrice: item.basePrice,
          costPrice: item.cost,
          gender: item.gender,
          categoryId: categories.get(item.category),
        },
        include: { images: { select: { url: true } } },
      });

      for (const color of item.colors) {
        for (const [index, size] of item.sizes.entries()) {
          // Stok awal bervariasi, termasuk beberapa ukuran yang sengaja habis.
          const stock = (index + color.length) % 4 === 0 ? 0 : 3 + ((index * 2 + color.length) % 6);
          const variant = await prisma.productVariant.create({
            data: {
              productId: product.id,
              size,
              color,
              sku: `${slug(item.name)}-${slug(color)}-${size}`.toUpperCase(),
              stock,
              avgCost: item.cost,
            },
          });
          if (stock > 0) {
            await prisma.stockMovement.create({
              data: {
                variantId: variant.id,
                type: 'IN',
                quantity: stock,
                stockAfter: stock,
                unitCost: item.cost,
                note: 'Stok awal',
                createdById: admin.id,
              },
            });
          }
        }
      }
    } else if (product.gender === 'UNISEX' && item.gender !== 'UNISEX') {
      // Produk yang dibuat sebelum kolom gender ada masih bernilai default UNISEX.
      await prisma.product.update({ where: { id: product.id }, data: { gender: item.gender } });
    }

    // Pasang gambar seed yang file-nya sudah ada dan belum terpasang. Gambar yang
    // belum dibuat dilewati; jalankan seed lagi setelah file-nya ditaruh di public/.
    const attached = new Set(product.images.map((image) => image.url));
    const missing = item.images
      .map((url, sortOrder) => ({ url, sortOrder }))
      .filter(({ url }) => !attached.has(url) && imageExists(url));
    if (missing.length > 0) {
      await prisma.productImage.createMany({ data: missing.map((image) => ({ productId: product.id, ...image })) });
    }
    const pending = item.images.filter((url) => !imageExists(url));
    if (pending.length > 0) console.log(`  Gambar belum ada untuk ${item.name}: ${pending.join(', ')}`);
  }

  const aeroRun = await prisma.product.findUnique({ where: { slug: 'aero-run-2' } });
  if (aeroRun && (await prisma.discount.count({ where: { productId: aeroRun.id } })) === 0) {
    await prisma.discount.create({ data: { productId: aeroRun.id, type: 'PERCENT', value: 15 } });
  }

  console.log('Seed selesai. Akun contoh (password sama untuk semuanya):', DEMO_PASSWORD);
  for (const account of ACCOUNTS) console.log(`  ${account.role.padEnd(8)} ${account.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
