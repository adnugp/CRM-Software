import React from 'react';
import { Link } from 'react-router-dom';
import { ProductLogo } from '@/components/brand/BrandMark';
import { PRODUCT_NAME } from '@/config/product';

/** Page frame for signed-out screens (sign-up, invite links). */
export default function PublicShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className={wide ? 'mx-auto max-w-5xl' : 'mx-auto max-w-md'}>
        <Link to="/" className="mb-8 flex items-center justify-center gap-3">
          <ProductLogo className="h-10 w-10" />
          <span className="text-xl font-bold text-foreground">{PRODUCT_NAME}</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
