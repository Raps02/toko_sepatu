'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/dashboard/PageHeader';
import { PriceTag } from '@/components/shop/ProductCard';
import { PurchasePanel } from '@/components/shop/PurchasePanel';
import { Stars } from '@/components/shop/Stars';
import { Button } from '@/components/ui/Button';
import { OPEN_CHAT_EVENT } from '@/components/chat/events';
import { imageIndexForColor } from '@/lib/product-images';
import { GENDER_LABEL, type Gender } from '@/lib/sizes';

type ImageItem = { id: string; url: string };
type VariantItem = { id: string; size: string; color: string; stock: number };

type Props = {
  productName: string;
  gender: Gender;
  categoryName?: string | null;
  description?: string | null;
  images: ImageItem[];
  variants: VariantItem[];
  price: { basePrice: number; finalPrice: number; discountAmount: number; percentOff: number };
  ratingAvg: number;
  ratingCount: number;
  viewer: 'guest' | 'customer' | 'staff';
};

export function ProductShowcase({
  productName,
  gender,
  categoryName,
  description,
  images,
  variants,
  price,
  ratingAvg,
  ratingCount,
  viewer,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const totalImages = images.length;
  const activeImage = images[activeIndex] ?? images[0];

  function handleColorChange(color: string) {
    if (totalImages <= 1) return;
    setActiveIndex(imageIndexForColor(images, color));
  }

  function prevImage() {
    if (totalImages <= 1) return;
    setActiveIndex((prev) => (prev - 1 + totalImages) % totalImages);
  }

  function nextImage() {
    if (totalImages <= 1) return;
    setActiveIndex((prev) => (prev + 1) % totalImages);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      {/* Gallery column */}
      <div className="min-w-0 lg:col-span-7">
        <div className="flex flex-col-reverse gap-3 lg:sticky lg:top-24 lg:flex-row">
          {totalImages > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-1 lg:w-16 lg:flex-col lg:overflow-visible lg:pb-0">
              {images.map((img, index) => {
                const active = index === activeIndex;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    aria-label={`Lihat foto ${index + 1} ${productName}`}
                    aria-pressed={active}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-studio-card transition-all ${
                      active ? 'border-ink ring-1 ring-ink' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Image src={img.url} alt="" fill sizes="64px" unoptimized className="object-cover" />
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative aspect-square flex-1 overflow-hidden rounded-xl bg-studio-card">
            {activeImage ? (
              <Image
                src={activeImage.url}
                alt={`${productName} foto ${activeIndex + 1}`}
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                priority
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-8" aria-hidden>
                <span className="font-display text-5xl font-bold uppercase text-asphalt-300">{productName}</span>
              </div>
            )}

            {totalImages > 1 && (
              <>
                <span className="tabular absolute left-4 top-4">
                  <Badge>
                    {activeIndex + 1} / {totalImages}
                  </Badge>
                </span>
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <Button variant="pillSecondary" onClick={prevImage} aria-label="Foto sebelumnya" className="!px-2.5">
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </Button>
                  <Button variant="pillSecondary" onClick={nextImage} aria-label="Foto berikutnya" className="!px-2.5">
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Purchase details column */}
      <div className="min-w-0 lg:col-span-5">
        <p className="text-sm font-medium text-ink-muted">
          {categoryName ? `Sepatu ${categoryName}` : 'Sepatu'} {GENDER_LABEL[gender]}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{productName}</h1>

        {ratingCount > 0 && (
          <a href="#review" className="mt-3 inline-flex items-center gap-2 text-sm text-ink hover:underline">
            <Stars value={ratingAvg} />
            <span className="tabular font-medium">
              {ratingAvg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} ({ratingCount} ulasan)
            </span>
          </a>
        )}

        <div className="mt-5">
          <PriceTag {...price} large />
        </div>

        <div className="mt-7">
          <PurchasePanel variants={variants} viewer={viewer} gender={gender} onColorChange={handleColorChange} />
        </div>

        {viewer !== 'staff' && (
          <Button variant="pillSecondary" size="lg" onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))} className="mt-3 w-full">
            <MessageSquare className="h-4 w-4" aria-hidden />
            Tanya Toko Soal Sepatu Ini
          </Button>
        )}

        {description && (
          <div className="mt-8 border-t border-studio-line pt-6">
            <h2 className="text-base font-semibold text-ink">Tentang Sepatu Ini</h2>
            <p className="mt-2.5 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink-muted">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
