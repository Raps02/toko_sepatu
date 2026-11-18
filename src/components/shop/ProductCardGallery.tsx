'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/arc/card/card';
import { Badge } from '@/components/dashboard/PageHeader';

type GalleryImage = { id: string; url: string };

type Props = {
  images: GalleryImage[];
  productName: string;
  href: string;
  soldOut: boolean;
  percentOff: number;
  /** Label kecil di atas nama, mis. "Penawaran Spesial". */
  status?: ReactNode;
  /** Kategori, warna, ukuran, dan harga. Dirender di server oleh ProductCard. */
  children: ReactNode;
};

/**
 * Kartu produk di atas Card Arc: foto (bisa diganti lewat thumbnail), nama
 * yang menjadi link ke halaman produk untuk seluruh kartu, lalu info dan harga.
 * Tanpa quick look, jadi klik kartu tetap membuka halaman produk seperti biasa.
 */
export function ProductCardGallery({ images, productName, href, soldOut, percentOff, status, children }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeUrl = images[activeIndex]?.url ?? images[0]?.url;

  const media = (
    <div className="relative aspect-square w-full bg-studio-card">
      {!activeUrl ? (
        <div className="flex h-full w-full items-center justify-center p-6" aria-hidden>
          <span className="text-center font-display text-3xl font-bold uppercase tracking-tight text-asphalt-300">
            {productName}
          </span>
        </div>
      ) : (
        <Image
          src={activeUrl}
          alt={productName}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          unoptimized
          className="object-cover"
        />
      )}

      {(soldOut || percentOff > 0) && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
          {soldOut ? (
            <Badge tone="dark">Stok habis</Badge>
          ) : (
            <Badge tone="warn">Hemat {percentOff}%</Badge>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Card
      className="h-full"
      media={media}
      title={
        <Link href={href} className="after:absolute after:inset-0 after:z-0">
          {productName}
        </Link>
      }
    >
      {status}
      {images.length > 1 && (
        <div className="relative z-10 mt-2.5 flex items-center gap-1.5" role="group" aria-label={`Pilihan foto ${productName}`}>
          {images.slice(0, 4).map((img, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={img.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveIndex(idx);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                aria-label={`Lihat varian foto ${idx + 1} ${productName}`}
                aria-pressed={active}
                className={`relative h-9 w-9 overflow-hidden rounded border bg-studio-card transition-all ${
                  active ? 'border-ink ring-1 ring-ink' : 'border-transparent opacity-75 hover:opacity-100'
                }`}
              >
                <Image src={img.url} alt="" fill sizes="36px" unoptimized className="object-cover" />
              </button>
            );
          })}
        </div>
      )}
      {children}
    </Card>
  );
}
