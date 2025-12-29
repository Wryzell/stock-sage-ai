import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { ForecastChart } from '@/components/ForecastChart';
import { mockProducts, mockForecasts } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { TrendingUp, Download, RefreshCw, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Forecast() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  
  const [dateRange, setDateRange] = useState('30');
  const [algorithm, setAlgorithm] = useState('exponential');
  const [confidence, setConfidence] = useState([80]);
  const [isGenerating, setIsGenerating] = useState(false);

  const categories = [...new Set(mockProducts.map(p => p.category))];

  const handleGenerateForecast = async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsGenerating(false);
    toast.success('AI Forecast generated successfully');
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    toast.success(`Exporting forecast as ${format.toUpperCase()}...`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-heading">AI Forecasting</h1>
            <p className="text-muted-foreground mt-1">
              {isSuperAdmin ? 'Configure and generate demand forecasts' : 'View demand forecasts'}
            </p>
          </div>
          {isSuperAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleExport('excel')} className="gap-2">
                <FileSpreadsheet size={18} />
                Export Excel
              </Button>
              <Button variant="outline" onClick={() => handleExport('pdf')} className="gap-2">
                <Download size={18} />
                Export PDF
              </Button>
            </div>
          )}
        </div>

        {/* Control Panel - Super Admin Only */}
        {isSuperAdmin && (
          <div className="card-stock-sage animate-fade-in">
            <h3 className="text-lg font-semibold text-heading mb-4">Forecast Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label>Forecast Period</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="60">60 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Algorithm</Label>
                <Select value={algorithm} onValueChange={setAlgorithm}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moving">7-Day Moving Average</SelectItem>
                    <SelectItem value="exponential">Exponential Smoothing</SelectItem>
                    <SelectItem value="linear">Linear Regression</SelectItem>
                    <SelectItem value="seasonal">Seasonal Detection</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Product Category</Label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Confidence Threshold: {confidence}%</Label>
                <Slider
                  value={confidence}
                  onValueChange={setConfidence}
                  max={100}
                  min={50}
                  step={5}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleGenerateForecast} disabled={isGenerating} className="gap-2">
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Generate Forecast
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Staff View - Request Button */}
        {!isSuperAdmin && (
          <div className="card-stock-sage animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-heading">Forecast Updates</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Contact Super Admin to request a new forecast analysis
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => toast.success('Forecast update request sent to Super Admin')}
              >
                Request Forecast Update
              </Button>
            </div>
          </div>
        )}

        {/* Forecast Chart */}
        <ForecastChart title="Historical vs Predicted Sales" />

        {/* Forecast Results Table */}
        <div className="card-stock-sage animate-fade-in">
          <h3 className="text-lg font-semibold text-heading mb-4">Forecast Predictions</h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Forecast Date</th>
                  <th>Predicted Demand</th>
                  <th>Confidence</th>
                  <th>Algorithm</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {mockForecasts.map((forecast) => (
                  <tr key={forecast.id}>
                    <td className="font-medium">{forecast.productName}</td>
                    <td>{new Date(forecast.forecastDate).toLocaleDateString()}</td>
                    <td className="font-semibold">{forecast.predictedDemand} units</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${forecast.confidenceLevel}%` }}
                          />
                        </div>
                        <span className="text-sm">{forecast.confidenceLevel}%</span>
                      </div>
                    </td>
                    <td>{forecast.algorithmUsed}</td>
                    <td>
                      {forecast.predictedDemand > 15 ? (
                        <span className="status-badge status-warning">Increase Stock</span>
                      ) : (
                        <span className="status-badge status-success">Maintain Level</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Insights */}
        <div className="card-stock-sage animate-fade-in">
          <h3 className="text-lg font-semibold text-heading mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" />
            AI Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-md bg-primary-light border border-primary/20">
              <p className="font-medium text-heading">Demand Surge Detected</p>
              <p className="text-sm text-muted-foreground mt-1">
                Laptops category expected to see +25% increase in January due to Back to School season.
              </p>
            </div>
            <div className="p-4 rounded-md bg-warning/10 border border-warning/20">
              <p className="font-medium text-heading">Stockout Risk Alert</p>
              <p className="text-sm text-muted-foreground mt-1">
                Webcams may run out in 5 days based on current sales velocity. Consider reorder.
              </p>
            </div>
            <div className="p-4 rounded-md bg-success/10 border border-success/20">
              <p className="font-medium text-heading">Optimal Stock Levels</p>
              <p className="text-sm text-muted-foreground mt-1">
                Storage devices maintaining healthy inventory turnover. No action required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
