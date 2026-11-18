'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Carousel } from '@/components/arc/carousel/carousel';
import { ButtonLink } from '@/components/ui/ButtonLink';

export type HeroSlide = {
  id: string;
  image: string;
  alt: string;
  eyebrow: string;
  titleLines: [string, string];
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
};

type Props = {
  slides: HeroSlide[];
  autoPlayMs?: number;
};

// Tombol di atas foto gelap memakai warna terang.
const LIGHT_BUTTON = { '--foreground': '#ffffff', '--background': '#111111' } as CSSProperties;
const GLASS_BUTTON = { '--surface': 'rgb(255 255 255 / 0.1)', '--foreground': '#ffffff', '--border': 'rgb(255 255 255 / 0.4)' } as CSSProperties;

/** Banner utama di atas Carousel Arc: bisa digeser, punya indikator, dan berganti otomatis. */
export function HeroBannerCarousel({ slides, autoPlayMs = 5500 }: Props) {
  if (slides.length === 0) return null;

  return (
    <Carousel
      label="Sorotan koleksi utama"
      slideSize="100cqw"
      interval={autoPlayMs}
      autoplay
      slideLabel={(index, count) => `Banner ${index + 1} dari ${count}`}
      className="[--radius-panel:0px] [&>div:nth-of-type(2)]:mx-auto [&>div:nth-of-type(2)]:max-w-[1440px] [&>div:nth-of-type(2)]:px-4 sm:[&>div:nth-of-type(2)]:px-8 lg:[&>div:nth-of-type(2)]:px-12"
    >
      {slides.map((slide, index) => {
        const HeadingTag = index === 0 ? 'h1' : 'h2';
        return (
          <div key={slide.id} className="bg-[#0B0D10] text-white">
            <div className="relative mx-auto min-h-[500px] max-w-[1440px] sm:min-h-[560px] lg:min-h-[620px]">
              <Image
                src={slide.image}
                alt={slide.alt}
                fill
                priority={index === 0}
                loading={index === 0 ? undefined : 'eager'}
                unoptimized
                sizes="100vw"
                className="object-cover object-right md:object-center"
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#0B0D10]/95 via-[#0B0D10]/70 to-transparent" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0B0D10]/85 via-transparent to-transparent sm:hidden" />

              <div className="relative z-10 flex min-h-[500px] max-w-2xl flex-col justify-end px-4 pb-12 pt-12 sm:min-h-[560px] sm:justify-center sm:px-8 lg:min-h-[620px] lg:px-12">
                <p className="text-sm font-medium text-white/75">{slide.eyebrow}</p>
                <HeadingTag className="mt-3 font-display text-5xl font-bold uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
                  {slide.titleLines[0]}
                  <br />
                  {slide.titleLines[1]}
                </HeadingTag>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">{slide.description}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <ButtonLink href={slide.primaryCta.href} variant="primary" size="lg" pill style={LIGHT_BUTTON}>
                    {slide.primaryCta.label}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </ButtonLink>
                  <ButtonLink href={slide.secondaryCta.href} variant="secondary" size="lg" pill style={GLASS_BUTTON}>
                    {slide.secondaryCta.label}
                  </ButtonLink>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </Carousel>
  );
}
