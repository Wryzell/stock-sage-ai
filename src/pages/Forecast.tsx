import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { ForecastChart } from '@/components/ForecastChart';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Download, RefreshCw, FileSpreadsheet, Loader2, AlertTriangle, Lightbulb, Info, ChevronRight, Code, Package, Target, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateForecasts, type ForecastData, type ForecastResult } from '@/lib/forecasting';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function Forecast() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [dateRange, setDateRange] = useState('30');
  const [isGenerating, setIsGenerating] = useState(false);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [selectedForecast, setSelectedForecast] = useState<ForecastResult | null>(null);
  const [showAlgorithm, setShowAlgorithm] = useState(false);

  const handleGenerateForecast = async () => {
    setIsGenerating(true);
    try {
      // Fetch sales data from database
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*, products(id, name, category, current_stock, min_stock)')
        .order('sale_date', { ascending: false })
        .limit(100);

      if (salesError) throw salesError;

      // Fetch all products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, category, current_stock, min_stock');

      if (productsError) throw productsError;

      // Transform data for forecasting engine
      const transformedSales = (salesData || []).map(sale => ({
        productId: sale.product_id,
        productName: sale.products?.name || 'Unknown',
        category: sale.products?.category || 'Uncategorized',
        quantity: sale.quantity,
        total: sale.total,
        date: sale.sale_date,
        currentStock: sale.products?.current_stock || 0,
        minStock: sale.products?.min_stock || 0
      }));

      const transformedProducts = (products || []).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        currentStock: p.current_stock,
        minStock: p.min_stock
      }));

      // Run pure JavaScript forecasting algorithm
      const forecastDays = parseInt(dateRange);
      const result = generateForecasts(transformedSales, transformedProducts, forecastDays);
      
      setForecastData(result);
      toast.success('Forecast generated using JavaScript algorithms');
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
        return <AlertTriangle size={16} className="text-warning" />;
      case 'opportunity':
        return <Lightbulb size={16} className="text-success" />;
      default:
        return <Info size={16} className="text-primary" />;
    }
  };

  const getInsightLabel = (type: string) => {
    switch (type) {
      case 'warning':
        return 'Action Needed';
      case 'opportunity':
        return 'Opportunity';
      default:
        return 'Tip';
    }
  };

  const getInsightStyle = (type: string) => {
    switch (type) {
      case 'warning':
        return 'border-l-4 border-l-warning bg-warning/5';
      case 'opportunity':
        return 'border-l-4 border-l-success bg-success/5';
      default:
        return 'border-l-4 border-l-primary bg-primary-light';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp size={16} className="text-success" />;
      case 'decreasing':
        return <TrendingDown size={16} className="text-danger" />;
      default:
        return <Minus size={16} className="text-muted-foreground" />;
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'high':
        return <Badge variant="destructive" className="text-xs">High Risk</Badge>;
      case 'medium':
        return <Badge variant="outline" className="text-xs border-warning text-warning">Medium</Badge>;
      default:
        return <Badge variant="outline" className="text-xs border-success text-success">Low</Badge>;
    }
  };

  const forecasts = forecastData?.forecasts || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-heading flex items-center gap-2">
              <Code size={24} className="text-primary" />
              JavaScript Demand Forecast
            </h1>
            <p className="text-muted-foreground mt-1">
              Pure JavaScript algorithms - No external AI APIs
            </p>
          </div>
          {isAdmin && forecastData && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')} className="gap-2">
                <FileSpreadsheet size={16} />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="gap-2">
                <Download size={16} />
                PDF
              </Button>
            </div>
          )}
        </div>

        {/* Quick Start / Generate Section */}
        <div className="card-stock-sage animate-fade-in">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-base font-semibold text-heading mb-1">Generate New Forecast</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Analyze your sales data using exponential smoothing algorithm
              </p>
              
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5 min-w-[140px]">
                  <Label className="text-xs text-muted-foreground">Time Period</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">Next 30 Days</SelectItem>
                      <SelectItem value="60">Next 60 Days</SelectItem>
                      <SelectItem value="90">Next 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleGenerateForecast} disabled={isGenerating} className="gap-2 h-9">
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      Generate Forecast
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Algorithm Code Display */}
        {forecastData?.algorithmCode && (
          <Collapsible open={showAlgorithm} onOpenChange={setShowAlgorithm}>
            <div className="card-stock-sage animate-fade-in">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent">
                  <div className="flex items-center gap-2">
                    <Code size={18} className="text-primary" />
                    <span className="font-semibold text-heading">View Algorithm Code</span>
                  </div>
                  <ChevronRight size={18} className={`text-muted-foreground transition-transform ${showAlgorithm ? 'rotate-90' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono text-foreground">
                  <code>{forecastData.algorithmCode}</code>
                </pre>
                <p className="text-xs text-muted-foreground mt-3">
                  This forecast uses <strong>Exponential Smoothing</strong> with α=0.3, combined with linear regression for trend analysis and coefficient of variation for confidence scoring.
                </p>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Summary */}
        {forecastData?.summary && (
          <div className="card-stock-sage animate-fade-in border-l-4 border-l-primary">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <Target size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-heading mb-1">Summary</h3>
                <p className="text-muted-foreground">{forecastData.summary}</p>
              </div>
            </div>
          </div>
        )}

        {/* Insights */}
        {forecastData?.insights && forecastData.insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
            {forecastData.insights.map((insight, index) => (
              <div 
                key={index}
                className={`p-4 rounded-md ${getInsightStyle(insight.type)}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getInsightIcon(insight.type)}
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {getInsightLabel(insight.type)}
                  </span>
                </div>
                <p className="font-medium text-heading text-sm mb-1">{insight.title}</p>
                <p className="text-sm text-muted-foreground">{insight.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Historical Chart */}
        <ForecastChart title="Sales Trend (Historical vs Predicted)" />

        {/* Predictions List */}
        <div className="card-stock-sage animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-heading">Product Predictions</h3>
              <p className="text-sm text-muted-foreground">
                Click any product to see detailed recommendation
              </p>
            </div>
            {forecasts.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {forecasts.length} products
              </span>
            )}
          </div>

          {forecasts.length > 0 ? (
            <div className="space-y-2">
              {forecasts.map((forecast, index) => (
                <div 
                  key={index}
                  onClick={() => setSelectedForecast(forecast)}
                  className="flex items-center gap-4 p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer transition-colors group"
                >
                  <div className="p-2 bg-muted rounded-md">
                    <Package size={18} className="text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-heading truncate">{forecast.productName}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        {getTrendIcon(forecast.trend)}
                        <span className="capitalize">{forecast.trend}</span>
                      </span>
                      <span>•</span>
                      <span>{forecast.confidenceLevel}% confidence</span>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <p className="font-semibold text-heading">{forecast.predictedDemand} units</p>
                    <p className="text-xs text-muted-foreground">predicted demand</p>
                  </div>

                  <div className="hidden md:block">
                    {getRiskBadge(forecast.stockoutRisk)}
                  </div>

                  <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              ))}
            </div>
          ) : forecastData ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle size={40} className="mx-auto mb-3 text-warning opacity-70" />
              <p className="font-medium">Not enough data</p>
              <p className="text-sm mt-1">Add more sales records to generate predictions</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">No forecast yet</p>
              <p className="text-sm mt-1">
                Click "Generate Forecast" above to start
              </p>
            </div>
          )}
        </div>

        {/* Product Detail Dialog */}
        <Dialog open={!!selectedForecast} onOpenChange={() => setSelectedForecast(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Package size={20} className="text-primary" />
                {selectedForecast?.productName}
              </DialogTitle>
            </DialogHeader>
            {selectedForecast && (
              <div className="space-y-5">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground mb-1">Predicted Demand</p>
                    <p className="text-xl font-bold text-heading">{selectedForecast.predictedDemand}</p>
                    <p className="text-xs text-muted-foreground">units needed</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground mb-1">Reorder Now</p>
                    <p className="text-xl font-bold text-primary">{selectedForecast.suggestedReorderQty}</p>
                    <p className="text-xs text-muted-foreground">units to order</p>
                  </div>
                </div>

                {/* Status Row */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    {getTrendIcon(selectedForecast.trend)}
                    <span className="capitalize">{selectedForecast.trend} trend</span>
                  </div>
                  <span className="text-muted-foreground">•</span>
                  <span>{selectedForecast.confidenceLevel}% confidence</span>
                  <span className="text-muted-foreground">•</span>
                  {getRiskBadge(selectedForecast.stockoutRisk)}
                </div>

                {/* Recommendation */}
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                  <p className="text-xs font-medium text-primary mb-2 uppercase tracking-wide">
                    Algorithm Recommendation
                  </p>
                  <p className="text-foreground leading-relaxed">{selectedForecast.recommendation}</p>
                </div>

                {/* Algorithm Info */}
                <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
                  <p className="font-medium mb-1">Calculation Method:</p>
                  <p>Exponential Smoothing (α=0.3) + Linear Regression Trend Analysis</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
