import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action }) => {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
      <div>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-2 text-sm leading-relaxed max-w-2xl text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export default PageHeader;
