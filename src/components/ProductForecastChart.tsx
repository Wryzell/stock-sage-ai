import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, addDays, parseISO } from 'date-fns';

interface SalesDataPoint {
  date: string;
  quantity: number;
}

interface ProductForecastChartProps {
  productName: string;
  historicalData: SalesDataPoint[];
  predictedDemand: number;
  forecastDays: number;
}

export function ProductForecastChart({ 
  productName, 
  historicalData, 
  predictedDemand,
  forecastDays 
}: ProductForecastChartProps) {
  // Group historical data by week
  const aggregateByWeek = (data: SalesDataPoint[]) => {
    const weeklyData = new Map<string, number>();
    
    data.forEach(point => {
      try {
        const date = parseISO(point.date);
        const weekStart = format(subDays(date, date.getDay()), 'MMM d');
        weeklyData.set(weekStart, (weeklyData.get(weekStart) || 0) + point.quantity);
      } catch {
        // Skip invalid dates
      }
    });
    
    return Array.from(weeklyData.entries()).map(([week, quantity]) => ({
      period: week,
      actual: quantity,
      predicted: null as number | null
    }));
  };

  // Generate forecast periods
  const generateForecastPeriods = (days: number, weeklyDemand: number) => {
    const periods: { period: string; actual: null; predicted: number }[] = [];
    const weeksToForecast = Math.ceil(days / 7);
    const today = new Date();
    
    for (let i = 0; i < weeksToForecast; i++) {
      const weekStart = addDays(today, i * 7);
      periods.push({
        period: format(weekStart, 'MMM d') + '*',
        actual: null,
        predicted: Math.round(weeklyDemand)
      });
    }
    
    return periods;
  };

  // Calculate weekly demand from predicted total
  const weeklyDemand = predictedDemand / Math.ceil(forecastDays / 7);
  
  // Combine historical and forecast data
  const weeklyHistorical = aggregateByWeek(historicalData);
  const forecastPeriods = generateForecastPeriods(forecastDays, weeklyDemand);
  
  // Take last 6 weeks of historical data + forecast
  const recentHistorical = weeklyHistorical.slice(-6);
  
  // Add predicted line to last historical point for continuity
  if (recentHistorical.length > 0 && forecastPeriods.length > 0) {
    const lastHistorical = recentHistorical[recentHistorical.length - 1];
    // Bridge the gap
    forecastPeriods[0] = {
      ...forecastPeriods[0],
      predicted: Math.round((lastHistorical.actual + weeklyDemand) / 2)
    };
  }

  const chartData = [...recentHistorical, ...forecastPeriods];

  // If no data, show placeholder
  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <p>No historical data available for this product</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="period" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              tickLine={false}
              axisLine={false}
              label={{ 
                value: 'Units', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }
              }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                `${value} units`, 
                name === 'actual' ? 'Historical Sales' : 'Predicted Demand'
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend 
              formatter={(value) => value === 'actual' ? 'Historical Sales' : 'Predicted Demand'}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
              name="actual"
            />
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: 'hsl(var(--success))', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls={true}
              name="predicted"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-primary"></div>
          <span>Historical Sales (Weekly)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-success" style={{ borderTop: '2px dashed' }}></div>
          <span>Predicted Demand (* forecast)</span>
        </div>
      </div>
    </div>
  );
}
