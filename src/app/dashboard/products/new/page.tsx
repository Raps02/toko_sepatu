import type { Metadata } from 'next';
import { createProductAction } from '@/actions/product.actions';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { GENDER_LABEL } from '@/lib/sizes';
import { GENDERS } from '@/lib/validations';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Tambah produk' };

export default async function NewProductPage() {
  const user = await requirePagePermission('product.manage');
  const seesCost = can(user.role, 'cost.view');
  const publishes = can(user.role, 'product.publish');
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });

  return (
    <>
      <PageHeader
        title="Tambah produk baru"
        description="Setelah disimpan, kamu akan diarahkan ke halaman detail untuk mengisi ukuran, warna, dan foto produk."
      />

      <div className="max-w-2xl">
      <Panel title="Informasi produk">
      <ActionForm action={createProductAction} className="space-y-5">
        <TextField label="Nama produk" name="name" placeholder="Misal: Aero Run 2" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Merek" name="brand" required />
          <SelectField label="Kategori" name="categoryId" defaultValue="">
            <option value="">Tanpa kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
        </div>
        <SelectField label="Untuk" name="gender" defaultValue="UNISEX" hint="Pria/Unisex tampil di menu Pria, Wanita/Unisex di menu Wanita.">
          {GENDERS.map((gender) => (
            <option key={gender} value={gender}>
              {GENDER_LABEL[gender]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Harga jual (Rp)"
          name="basePrice"
          type="number"
          min={1000}
          step={1}
          inputMode="numeric"
          placeholder="750000"
          required
          hint="Harga awal. Perubahan harga setelah ini dicatat lewat menu Harga & diskon."
        />
        {seesCost && (
          <TextField
            label="Harga modal per pasang (Rp)"
            name="costPrice"
            type="number"
            min={1000}
            step={1}
            inputMode="numeric"
            placeholder="450000"
            required
            hint="Dipakai menghitung laba kotor di laporan. Hanya admin yang melihat dan mengisi ini."
          />
        )}
        <TextAreaField label="Deskripsi" name="description" rows={4} hint="Bahan, kegunaan, dan hal yang perlu diketahui pembeli." />
        {publishes ? (
          <CheckboxField label="Tayang di toko" name="isPublished" hint="Biarkan mati kalau ukuran dan fotonya belum lengkap." />
        ) : (
          <p className="rounded-lg bg-pavement px-3 py-2 text-sm text-ink-muted">
            Produk disimpan sebagai draf. Admin mengisi harga modal lalu menayangkannya di toko.
          </p>
        )}
        <div className="flex gap-2">
          <SubmitButton pendingLabel="Menyimpan…">Simpan produk</SubmitButton>
          <ButtonLink href="/dashboard/products" variant="ghost">
            Batal
          </ButtonLink>
        </div>
      </ActionForm>
      </Panel>
      </div>
    </>
  );
}
