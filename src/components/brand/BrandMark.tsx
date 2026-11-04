import { useWorkspace } from '@/contexts/WorkspaceContext';
import { PRODUCT_NAME } from '@/config/product';
import { cn } from '@/lib/utils';

/** The product's neutral logo mark. Takes the current primary colour. */
export function ProductLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="hsl(var(--primary))" />
      <path d="M9 10h14M9 16h10M9 22h6" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="22.5" cy="21.5" r="3" fill="white" />
    </svg>
  );
}

/**
 * Logo + name for the app chrome: the signed-in company's own logo and name
 * when set in Settings → Company, otherwise the product brand.
 */
export function BrandMark({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  const { workspace } = useWorkspace();
  const name = workspace?.name || PRODUCT_NAME;
  const box = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      {workspace?.logoUrl ? (
        <img src={workspace.logoUrl} alt="" className={cn(box, 'shrink-0 rounded-md bg-white object-contain p-0.5')} />
      ) : (
        <ProductLogo className={cn(box, 'shrink-0')} />
      )}
      <span className={cn('truncate font-bold leading-tight text-sidebar-foreground', size === 'lg' ? 'text-base' : 'text-sm')} title={name}>
        {name}
      </span>
    </div>
  );
}
