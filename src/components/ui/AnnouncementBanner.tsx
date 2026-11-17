import React from 'react';
import { Megaphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AnnouncementBannerProps {
  message: string;
  type?: 'info' | 'warning' | 'success';
  /** An optional link after the message, e.g. "Send feedback". */
  link?: { href: string; label: string };
  onDismiss?: () => void;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  message,
  type = 'info',
  link,
  onDismiss,
}) => {
  const bgMap = {
    info: 'bg-primary/10 border-primary/20',
    warning: 'bg-amber-500/10 border-amber-500/20',
    success: 'bg-green-500/10 border-green-500/20',
  };

  const iconMap = {
    info: 'text-primary',
    warning: 'text-amber-500',
    success: 'text-green-500',
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b ${bgMap[type]}`}>
      <Megaphone className={`h-4 w-4 shrink-0 ${iconMap[type]}`} />
      <p className="text-sm flex-1">
        {message}
        {link && (
          <>
            {' '}
            <a href={link.href} className="font-medium text-primary underline underline-offset-2">{link.label}</a>
          </>
        )}
      </p>
      {onDismiss && (
        <Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0" aria-label="Dismiss">

          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

export default AnnouncementBanner;
