import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { ForecastChart } from '@/components/ForecastChart';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { TrendingUp, Download, RefreshCw, FileSpreadsheet, Loader2, AlertTriangle, Lightbulb, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ForecastResult {
  productName: string;
  predictedDemand: number;
  confidenceLevel: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  recommendation: string;
  stockoutRisk: 'low' | 'medium' | 'high';
  suggestedReorderQty: number;
}

interface Insight {
  type: 'warning' | 'opportunity' | 'info';
  title: string;
  description: string;
}

interface ForecastData {
  forecasts: ForecastResult[];
  insights: Insight[];
  summary: string;
}

export default function Forecast() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  
  const [dateRange, setDateRange] = useState('30');
  const algorithm = 'exponential_smoothing';
  const [confidence, setConfidence] = useState([80]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);

  const handleGenerateForecast = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-forecast', {
        body: {
          algorithm,
          forecastDays: parseInt(dateRange),
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setForecastData(data);
      toast.success('AI Forecast generated successfully');
    } catch (error: unknown) {
      console.error('Forecast error:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate forecast';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    toast.success(`Exporting forecast as ${format.toUpperCase()}...`);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle size={18} className="text-warning" />;
      case 'opportunity':
        return <Lightbulb size={18} className="text-success" />;
      default:
        return <Info size={18} className="text-primary" />;
    }
  };

  const getInsightStyle = (type: string) => {
    switch (type) {
      case 'warning':
        return 'bg-warning/10 border-warning/20';
      case 'opportunity':
        return 'bg-success/10 border-success/20';
      default:
        return 'bg-primary-light border-primary/20';
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'high':
        return <span className="status-badge status-danger">High Risk</span>;
      case 'medium':
        return <span className="status-badge status-warning">Medium Risk</span>;
      default:
        return <span className="status-badge status-success">Low Risk</span>;
    }
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted/50 flex items-center text-sm">
                  Exponential Smoothing
                </div>
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
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Generate AI Forecast
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

        {/* AI Summary */}
        {forecastData?.summary && (
          <div className="card-stock-sage animate-fade-in">
            <h3 className="text-lg font-semibold text-heading mb-3 flex items-center gap-2">
              <TrendingUp size={20} className="text-primary" />
              AI Analysis Summary
            </h3>
            <p className="text-muted-foreground">{forecastData.summary}</p>
          </div>
        )}

        {/* Forecast Results Table */}
        <div className="card-stock-sage animate-fade-in">
          <h3 className="text-lg font-semibold text-heading mb-4">Forecast Predictions</h3>
          {forecastData?.forecasts && forecastData.forecasts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Predicted Demand</th>
                    <th>Confidence</th>
                    <th>Trend</th>
                    <th>Stockout Risk</th>
                    <th>Reorder Qty</th>
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.forecasts
                    .filter(f => f.confidenceLevel >= confidence[0])
                    .map((forecast, index) => (
                      <tr key={index}>
                        <td className="font-medium">{forecast.productName}</td>
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
                        <td>
                          <span className={`capitalize ${
                            forecast.trend === 'increasing' ? 'text-success' :
                            forecast.trend === 'decreasing' ? 'text-danger' : 'text-muted-foreground'
                          }`}>
                            {forecast.trend}
                          </span>
                        </td>
                        <td>{getRiskBadge(forecast.stockoutRisk)}</td>
                        <td>{forecast.suggestedReorderQty} units</td>
                        <td className="max-w-[200px] truncate" title={forecast.recommendation}>
                          {forecast.recommendation}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
              <p>No forecast data available.</p>
              <p className="text-sm mt-1">
                {isSuperAdmin 
                  ? 'Click "Generate AI Forecast" to analyze your inventory data.' 
                  : 'Request a forecast update from your Super Admin.'}
              </p>
            </div>
          )}
        </div>

        {/* AI Insights */}
        {forecastData?.insights && forecastData.insights.length > 0 && (
          <div className="card-stock-sage animate-fade-in">
            <h3 className="text-lg font-semibold text-heading mb-4 flex items-center gap-2">
              <Lightbulb size={20} className="text-primary" />
              AI Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {forecastData.insights.map((insight, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-md border ${getInsightStyle(insight.type)}`}
                >
                  <p className="font-medium text-heading flex items-center gap-2">
                    {getInsightIcon(insight.type)}
                    {insight.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {insight.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Default insights when no AI data */}
        {!forecastData && (
          <div className="card-stock-sage animate-fade-in">
            <h3 className="text-lg font-semibold text-heading mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-primary" />
              AI Insights
            </h3>
            <div className="text-center py-6 text-muted-foreground">
              <p>Generate a forecast to see AI-powered insights about your inventory.</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
