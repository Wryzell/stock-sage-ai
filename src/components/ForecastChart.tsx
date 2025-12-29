import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { historicalSalesData } from '@/data/mockData';

interface ForecastChartProps {
  title?: string;
}

export function ForecastChart({ title = 'Sales Forecast Analysis' }: ForecastChartProps) {
  const formatCurrency = (value: number) => {
    return `₱${(value / 1000).toFixed(0)}K`;
  };

  return (
    <div className="card-stock-sage animate-fade-in">
      <h3 className="text-lg font-semibold text-heading mb-6">{title}</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={historicalSalesData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis 
              dataKey="month" 
              stroke="hsl(220, 9%, 46%)" 
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              tickFormatter={formatCurrency} 
              stroke="hsl(220, 9%, 46%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              formatter={(value: number) => [`₱${value.toLocaleString()}`, '']}
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(220, 13%, 91%)',
                borderRadius: '6px',
                boxShadow: 'none',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorActual)"
              name="Actual Sales"
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="predicted"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth={2}
              strokeDasharray="5 5"
              fillOpacity={1}
              fill="url(#colorPredicted)"
              name="Predicted Sales"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary"></div>
          <span className="text-muted-foreground">Historical Data</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success"></div>
          <span className="text-muted-foreground">AI Prediction</span>
        </div>
      </div>
    </div>
  );
}
