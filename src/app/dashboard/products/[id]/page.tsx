import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import {
  addVariantAction,
  deleteProductAction,
  deleteProductImageAction,
  deleteVariantAction,
  setVariantActiveAction,
  updateProductAction,
  uploadProductImageAction,
} from '@/actions/product.actions';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { CheckboxField, FileField, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { sortSizes } from '@/lib/catalog';
import { formatRupiah } from '@/lib/format';
import { can } from '@/lib/permissions';
import { resolvePrice } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';
import { GENDER_LABEL } from '@/lib/sizes';
import { GENDERS } from '@/lib/validations';

export const metadata: Metadata = { title: 'Ubah produk' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('product.manage');
  const { id } = await params;
  const seesCost = can(user.role, 'cost.view');
  const publishes = can(user.role, 'product.publish');
  const deletes = can(user.role, 'product.delete');

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
        discounts: { where: { isActive: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
  ]);
  if (!product) notFound();

  const price = resolvePrice(product.basePrice, product.discounts);
  const margin = price.finalPrice - product.costPrice;
  const sizeOrder = sortSizes([...new Set(product.variants.map((v) => v.size))]);
  const variants = product.variants.toSorted(
    (a, b) => a.color.localeCompare(b.color, 'id') || sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size),
  );

  return (
    <>
      <ButtonLink href="/dashboard/products" variant="ghost" size="sm" className="mb-3">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Semua produk
      </ButtonLink>

      <PageHeader
        title={product.name}
        tag={product.isPublished ? undefined : 'Draf'}
        description={`${product.brand}, dijual ${formatRupiah(price.finalPrice)}${
          price.discountAmount > 0 ? ` (harga dasar ${formatRupiah(price.basePrice)})` : ''
        }`}
        actions={
          <>
            <ButtonLink href={`/dashboard/pricing?product=${product.id}`} variant="secondary" size="sm">
              Ubah harga / diskon
            </ButtonLink>
            {product.isPublished && (
              <ButtonLink href={`/products/${product.slug}`} variant="secondary" size="sm">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Lihat di toko
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Informasi produk">
          <ActionForm action={updateProductAction} className="space-y-4">
            <input type="hidden" name="id" value={product.id} />
            <TextField label="Nama produk" name="name" defaultValue={product.name} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Merek" name="brand" defaultValue={product.brand} required />
              <SelectField label="Kategori" name="categoryId" defaultValue={product.categoryId ?? ''}>
                <option value="">Tanpa kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <SelectField label="Untuk" name="gender" defaultValue={product.gender} hint="Pria/Unisex tampil di menu Pria, Wanita/Unisex di menu Wanita.">
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {GENDER_LABEL[gender]}
                </option>
              ))}
            </SelectField>
            {seesCost && (
              <TextField
                label="Harga modal per pasang (Rp)"
                name="costPrice"
                type="number"
                min={1000}
                step={1}
                inputMode="numeric"
                defaultValue={product.costPrice || ''}
                required
                hint={
                  product.costPrice > 0
                    ? `Untung kotor ${formatRupiah(margin)} per pasang dari harga jual sekarang (${Math.round((margin / price.finalPrice) * 100)}%). Hanya admin yang melihat ini.`
                    : 'Belum diisi. Wajib diisi sebelum produk ditayangkan. Hanya admin yang melihat ini.'
                }
              />
            )}
            <TextAreaField label="Deskripsi" name="description" rows={5} defaultValue={product.description ?? ''} />
            {publishes ? (
              <CheckboxField label="Tayang di toko" name="isPublished" defaultChecked={product.isPublished} />
            ) : (
              <p className="rounded-lg bg-pavement px-3 py-2 text-sm text-ink-muted">
                {product.isPublished
                  ? 'Produk ini sedang tayang di toko. Untuk menyembunyikannya, minta admin.'
                  : 'Masih draf. Lengkapi ukuran dan foto, lalu admin yang menayangkannya di toko.'}
              </p>
            )}
            <SubmitButton pendingLabel="Menyimpan…">Simpan perubahan</SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Foto produk" description="Foto pertama tampil sebagai foto utama di katalog.">

          {product.images.length > 0 && (
            <ul className="mb-4 grid grid-cols-3 gap-3">
              {product.images.map((image, index) => (
                <li key={image.id} className="rounded-lg border border-studio-line bg-[#FAFAFA] p-2">
                  <div className="relative aspect-square overflow-hidden rounded-md bg-studio-card">
                    <Image src={image.url} alt={`Foto ${index + 1} ${product.name}`} fill sizes="160px" unoptimized className="object-cover" />
                    {index === 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">
                        Utama
                      </span>
                    )}
                  </div>
                  <ActionForm action={deleteProductImageAction.bind(null, image.id)} confirmTone="danger" confirmLabel="Ya, hapus" confirmMessage="Hapus foto ini?" className="mt-2">
                    <SubmitButton variant="ghost" size="sm" className="w-full text-xs">
                      Hapus
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}

          <ActionForm action={uploadProductImageAction} resetOnSuccess className="space-y-3">
            <input type="hidden" name="productId" value={product.id} />
            <FileField
              label="Tambah foto"
              name="image"
              description="Tarik foto ke sini atau pilih dari perangkat"
              note="JPG, PNG, atau WebP, maksimal 3 MB"
              accept="image/jpeg,image/png,image/webp"
              maxSize={3 * 1024 * 1024}
              required
            />
            <SubmitButton variant="secondary" pendingLabel="Mengunggah…">
              Unggah foto
            </SubmitButton>
          </ActionForm>
        </Panel>
      </div>

      <div className="mt-6">
      <Panel title="Ukuran dan warna">
        <p className="mb-4 text-sm text-ink-muted">
          Tiap ukuran dan warna punya stok sendiri. Jumlah stok ditambah lewat menu{' '}
          <Link href="/dashboard/stock" className="font-medium text-ink underline">
            Stok
          </Link>
          .
        </p>

        {variants.length > 0 && (
          <DataTable
            caption="Ukuran dan warna"
            columns={[
              { key: 'color', label: 'Warna' },
              { key: 'size', label: 'Ukuran' },
              { key: 'sku', label: 'SKU' },
              { key: 'stock', label: 'Stok', numeric: true },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: 'Tindakan' },
            ]}
            rows={variants.map((variant) => ({
              id: variant.id,
              sort: { color: variant.color, size: variant.size, sku: variant.sku, stock: variant.stock, status: variant.isActive ? 'Dijual' : 'Nonaktif' },
              cells: {
                color: variant.color,
                size: variant.size,
                sku: <span className="text-xs text-ink-muted">{variant.sku}</span>,
                stock: <Badge tone={variant.stock === 0 ? 'bad' : variant.stock <= 2 ? 'warn' : 'neutral'}>{variant.stock}</Badge>,
                status: variant.isActive ? <Badge tone="good">Dijual</Badge> : <Badge>Nonaktif</Badge>,
                actions: (
                  <div className="flex gap-1">
                    <ActionForm action={setVariantActiveAction.bind(null, variant.id, !variant.isActive)}>
                      <SubmitButton variant="ghost" size="sm">
                        {variant.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </SubmitButton>
                    </ActionForm>
                    {deletes && (
                      <ActionForm
                        action={deleteVariantAction.bind(null, variant.id)}
                        confirmTone="danger"
                        confirmLabel="Ya, hapus"
                        confirmMessage={`Hapus ukuran ${variant.size} warna ${variant.color}?`}
                      >
                        <SubmitButton variant="ghost" size="sm">
                          Hapus
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                ),
              },
            }))}
          />
        )}

        <ActionForm action={addVariantAction} resetOnSuccess className="mt-4 grid items-start gap-3 sm:grid-cols-[7rem_1fr_1fr_auto]">
          <input type="hidden" name="productId" value={product.id} />
          <TextField label="Ukuran" name="size" placeholder="42" required />
          <TextField label="Warna" name="color" placeholder="Hitam" required />
          <TextField label="SKU" name="sku" placeholder="Otomatis jika kosong" />
          <div className="sm:pt-6">
            <SubmitButton variant="primary">Tambah varian</SubmitButton>
          </div>
        </ActionForm>
      </Panel>
      </div>

      {deletes && (
        <div className="mt-8">
          <Panel title="Hapus produk" tone="danger" description="Produk yang sudah pernah dipesan tidak bisa dihapus karena masih tercatat di riwayat order. Matikan “Tayang di toko” kalau ingin menyembunyikannya.">
        <ActionForm
            action={deleteProductAction.bind(null, product.id)}
            confirmTone="danger" confirmLabel="Ya, hapus" confirmMessage={`Hapus “${product.name}” beserta semua ukuran dan fotonya? Tindakan ini tidak bisa dibatalkan.`}
                      >
            <SubmitButton variant="danger" size="sm" pendingLabel="Menghapus…">
              Hapus produk ini
            </SubmitButton>
          </ActionForm>
        </Panel>
        </div>
      )}
    </>
  );
}
