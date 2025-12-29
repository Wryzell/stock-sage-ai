import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ForecastHighlight {
  product: string;
  message: string;
  trend: 'up' | 'down' | 'steady';
}

interface ForecastCardProps {
  highlights: ForecastHighlight[];
}

export function ForecastCard({ highlights }: ForecastCardProps) {
  const getTrendIcon = (trend: ForecastHighlight['trend']) => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={18} className="text-success" />;
      case 'down':
        return <TrendingDown size={18} className="text-danger" />;
      default:
        return <Minus size={18} className="text-muted-foreground" />;
    }
  };

  return (
    <div className="card-stock-sage animate-fade-in">
      <h3 className="text-lg font-semibold text-heading mb-4">AI Forecast Highlights</h3>
      <div className="space-y-4">
        {highlights.map((item, index) => (
          <div 
            key={index} 
            className="flex items-start gap-3 p-3 rounded-md bg-muted/50 border border-border"
          >
            {getTrendIcon(item.trend)}
            <div>
              <p className="font-medium text-sm text-heading">{item.product}</p>
              <p className="text-sm text-muted-foreground">{item.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
