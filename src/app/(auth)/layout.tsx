import Link from 'next/link';
import { BrandLogo } from '@/components/ui/BrandLogo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-white px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="inline-flex items-center">
          <BrandLogo tone="dark" size="md" />
        </Link>
        <div className="mt-7 rounded-2xl border border-studio-line bg-white p-7 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
