import { ComboboxField } from '@/components/ui/Field';
import { sortSizes } from '@/lib/catalog';
import { prisma } from '@/lib/prisma';

export type VariantOption = { id: string; size: string; color: string; stock: number };
export type VariantGroup = { productId: string; productName: string; variants: VariantOption[] };

/** Semua varian, dikelompokkan per produk dan diurutkan warna lalu ukuran. */
export async function loadVariantGroups(): Promise<VariantGroup[]> {
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      variants: { select: { id: true, size: true, color: true, stock: true } },
    },
  });

  return products
    .filter((product) => product.variants.length > 0)
    .map((product) => {
      const order = sortSizes([...new Set(product.variants.map((v) => v.size))]);
      return {
        productId: product.id,
        productName: product.name,
        variants: product.variants.toSorted(
          (a, b) => a.color.localeCompare(b.color, 'id') || order.indexOf(a.size) - order.indexOf(b.size),
        ),
      };
    });
}

export function VariantSelect({ id, groups, defaultValue }: { id: string; groups: VariantGroup[]; defaultValue?: string }) {
  const options = groups.flatMap((group) =>
    group.variants.map((variant) => ({
      value: variant.id,
      label: `${group.productName}, ${variant.color}, uk. ${variant.size} (stok ${variant.stock})`,
    })),
  );
  return (
    <ComboboxField
      id={id}
      label="Sepatu, warna, dan ukuran"
      name="variantId"
      options={options}
      defaultValue={defaultValue}
      placeholder="Cari atau pilih sepatu"
      emptyMessage="Sepatu tidak ditemukan"
      required
    />
  );
}
