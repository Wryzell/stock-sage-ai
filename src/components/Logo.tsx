import { BarChart3 } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export function Logo({ size = 'md', showTagline = false }: LogoProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const iconSizes = {
    sm: 20,
    md: 28,
    lg: 40,
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2">
        <BarChart3 size={iconSizes[size]} className="text-primary" strokeWidth={2.5} />
        <span className={`font-bold text-primary ${sizeClasses[size]}`}>
          STOCK SAGE
        </span>
      </div>
      {showTagline && (
        <p className="text-muted-foreground text-sm mt-1">
          Inventory Management with AI Intelligence
        </p>
      )}
    </div>
  );
}
