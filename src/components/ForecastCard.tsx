import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-heading">AI Forecast Highlights</h3>
      </div>
      <div className="space-y-3">
        {highlights.map((item, index) => (
          <div 
            key={index} 
            className="flex items-start gap-3 p-3 rounded-md bg-muted/50 border border-border"
          >
            {getTrendIcon(item.trend)}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-heading">{item.product}</p>
              <p className="text-sm text-muted-foreground">{item.message}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <Link to="/ai">
          <Button variant="outline" size="sm" className="w-full">
            View Full Forecast
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
