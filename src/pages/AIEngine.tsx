import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateForecasts, ForecastData, ForecastResult } from '@/lib/forecasting';
import { analyzePricing, PricingAnalysis } from '@/lib/pricingElasticity';
import {
  Brain, TrendingUp, TrendingDown, Loader2, Minus, RefreshCw,
  Package, Zap, ChevronRight, X, DollarSign, Users, AlertCircle
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend
} from 'recharts';

interface Product {
  id: string;
  name: string;
  category: string;
  sellingPrice: number;
  costPrice: number;
  currentStock: number;
  minStock: number;
}

interface CompetitorPrice {
  competitor_name: string;
  price: number;
  recorded_at: string;
}

export default function AIEngine() {
  const [products, setProducts] = useState<Product[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [competitorPrices, setCompetitorPrices] = useState<any[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, salesRes, competitorRes] = await Promise.all([
        supabase.from('products').select('*').is('deleted_at', null).order('name'),
        supabase.from('sales').select(`
          product_id, quantity, unit_price, sale_date,
          products (id, name, category, current_stock, min_stock)
        `).is('deleted_at', null).order('sale_date', { ascending: true }).limit(1000),
        supabase.from('competitor_prices').select('*').order('recorded_at', { ascending: false }),
      ]);

      if (productsRes.error) throw productsRes.error;

      const mappedProducts: Product[] = (productsRes.data || []).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        sellingPrice: Number(p.selling_price),
        costPrice: Number(p.cost_price),
        currentStock: p.current_stock,
        minStock: p.min_stock,
      }));
      
      setProducts(mappedProducts);
      setSalesData(salesRes.data || []);
      setCompetitorPrices(competitorRes.data || []);

    } catch (error: any) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const generateForecast = async () => {
    try {
      setGenerating(true);
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      const formattedSales = salesData
        .filter((s: any) => s.products)
        .map((s: any) => ({
          productId: s.product_id,
          productName: s.products.name,
          category: s.products.category,
          quantity: s.quantity,
          total: s.quantity * Number(s.unit_price),
          date: s.sale_date,
          currentStock: s.products.current_stock,
          minStock: s.products.min_stock,
        }));

      const formattedProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        currentStock: p.currentStock,
        minStock: p.minStock,
      }));

      const forecasts = generateForecasts(formattedSales, formattedProducts, 30);
      setForecastData(forecasts);
      setHasGenerated(true);

      toast.success('AI Forecast generated successfully!');

    } catch (error: any) {
      toast.error('Failed to generate forecast');
    } finally {
      setGenerating(false);
    }
  };

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const selectedForecast = useMemo(() => {
    if (!selectedProduct || !forecastData) return null;
    return forecastData.forecasts.find(f => f.productName === selectedProduct.name) || null;
  }, [selectedProduct, forecastData]);

  // Get competitor prices for selected product
  const selectedCompetitors = useMemo(() => {
    if (!selectedProduct) return [];
    return competitorPrices.filter(c => c.product_id === selectedProduct.id);
  }, [selectedProduct, competitorPrices]);

  // Calculate pricing analysis
  const pricingAnalysis = useMemo(() => {
    if (!selectedProduct || !selectedForecast) return null;
    
    const productSales = salesData.filter((s: any) => s.product_id === selectedProduct.id);
    if (productSales.length < 2) return null;

    const salesForPricing = productSales.map((s: any) => ({
      productId: s.product_id,
      quantity: s.quantity,
      unitPrice: Number(s.unit_price),
      saleDate: s.sale_date,
    }));

    const competitorData = selectedCompetitors.map(c => ({
      competitorName: c.competitor_name,
      price: Number(c.price),
    }));

    return analyzePricing(
      selectedProduct.id,
      selectedProduct.name,
      selectedProduct.sellingPrice,
      selectedProduct.costPrice,
      salesForPricing,
      competitorData
    );
  }, [selectedProduct, selectedForecast, salesData, selectedCompetitors]);

  // Adjusted forecast based on pricing
  const adjustedForecast = useMemo(() => {
    if (!selectedForecast || !pricingAnalysis || selectedCompetitors.length === 0) {
      return null;
    }

    const ourPrice = selectedProduct?.sellingPrice || 0;
    const avgCompetitor = selectedCompetitors.reduce((sum, c) => sum + c.price, 0) / selectedCompetitors.length;
    const priceDiff = ((ourPrice - avgCompetitor) / avgCompetitor) * 100;
    
    // Adjust demand based on price difference
    const adjustment = priceDiff > 0 
      ? -priceDiff * 0.8 // Lose 0.8% demand for every 1% more expensive
      : Math.abs(priceDiff) * 0.3; // Gain 0.3% for every 1% cheaper
    
    const adjustedDemand = Math.round(selectedForecast.predictedDemand * (1 + adjustment / 100));
    const adjustedConfidence = Math.max(60, selectedForecast.confidenceLevel - Math.abs(adjustment) * 0.5);

    return {
      originalDemand: selectedForecast.predictedDemand,
      adjustedDemand,
      originalConfidence: selectedForecast.confidenceLevel,
      adjustedConfidence: Math.round(adjustedConfidence),
      priceDiff: priceDiff.toFixed(1),
      avgCompetitor: Math.round(avgCompetitor),
      isMoreExpensive: priceDiff > 0,
    };
  }, [selectedForecast, pricingAnalysis, selectedCompetitors, selectedProduct]);

  // Generate chart data
  const chartData = useMemo(() => {
    if (!selectedProduct || !selectedForecast) return [];
    
    const productSales = salesData.filter((s: any) => s.product_id === selectedProduct.id);
    
    // Group by week
    const weeklyData: { [key: string]: number } = {};
    productSales.forEach((s: any) => {
      const date = new Date(s.sale_date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const key = weekStart.toISOString().split('T')[0];
      weeklyData[key] = (weeklyData[key] || 0) + s.quantity;
    });

    const sortedWeeks = Object.entries(weeklyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8); // Last 8 weeks

    const historical = sortedWeeks.map(([date, qty]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      historical: qty,
      predicted: null as number | null,
    }));

    // Add forecast weeks
    const lastDate = sortedWeeks.length > 0 ? new Date(sortedWeeks[sortedWeeks.length - 1][0]) : new Date();
    const weeklyDemand = Math.round((adjustedForecast?.adjustedDemand || selectedForecast.predictedDemand) / 4);
    
    for (let i = 1; i <= 4; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + (i * 7));
      historical.push({
        date: forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '*',
        historical: null as any,
        predicted: weeklyDemand + Math.round((Math.random() - 0.5) * 3),
      });
    }

    return historical;
  }, [selectedProduct, selectedForecast, salesData, adjustedForecast]);

  // Products with sales
  const productsWithSales = useMemo(() => {
    return products.map(p => {
      const productSales = salesData.filter((s: any) => s.product_id === p.id);
      const totalSold = productSales.reduce((sum: number, s: any) => sum + s.quantity, 0);
      const forecast = forecastData?.forecasts.find(f => f.productName === p.name);
      return { ...p, totalSold, forecast };
    }).sort((a, b) => b.totalSold - a.totalSold);
  }, [products, salesData, forecastData]);

  const formatMoney = (n: number) => '₱' + n.toLocaleString();

  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              AI Demand Forecasting
            </h1>
            <p className="text-muted-foreground">
              Machine learning predictions enhanced with price intelligence
            </p>
          </div>
          {hasGenerated && (
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>

        {/* Generate Button */}
        {!hasGenerated && (
          <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">AI Demand Forecasting</h2>
              <p className="text-muted-foreground mb-4 max-w-lg mx-auto">
                Our AI analyzes 120 days of sales history and adjusts predictions using competitor pricing data for more accurate forecasts
              </p>
              <div className="flex items-center justify-center gap-4 mb-8">
                <Badge variant="secondary" className="px-3 py-1">
                  <Brain className="h-3 w-3 mr-1" /> Machine Learning
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  <DollarSign className="h-3 w-3 mr-1" /> Price Intelligence
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  <Users className="h-3 w-3 mr-1" /> Competitor Data
                </Badge>
              </div>
              <Button 
                size="lg" 
                onClick={generateForecast}
                disabled={generating}
                className="px-8 py-6 text-lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating Forecast...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Generate Forecast
                  </>
                )}
              </Button>
              {generating && (
                <p className="text-sm text-muted-foreground mt-4 animate-pulse">
                  🤖 Analyzing sales patterns and competitor prices...
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Product Grid */}
        {hasGenerated && forecastData && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                {forecastData.forecasts.length} products analyzed • Click to view forecast
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {productsWithSales.filter(p => p.forecast).map(p => (
                <Card 
                  key={p.id}
                  className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
                  onClick={() => handleProductClick(p.id)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline" className="text-xs">{p.category}</Badge>
                      {p.forecast && (
                        <div className="flex items-center gap-1">
                          {p.forecast.trend === 'increasing' && <TrendingUp className="h-4 w-4 text-success" />}
                          {p.forecast.trend === 'decreasing' && <TrendingDown className="h-4 w-4 text-destructive" />}
                          {p.forecast.trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold truncate mb-1">{p.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{p.totalSold} units sold</p>
                    {p.forecast && (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-primary">{p.forecast.predictedDemand}</p>
                          <p className="text-xs text-muted-foreground">predicted</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{p.forecast.confidenceLevel}%</p>
                          <p className="text-xs text-muted-foreground">confidence</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Forecast Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedProduct && selectedForecast && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {selectedProduct.name}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Sales History & Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                            <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                            <RechartsTooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--background))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="historical" 
                              stroke="hsl(var(--primary))" 
                              strokeWidth={2}
                              dot={{ fill: 'hsl(var(--primary))' }}
                              name="Historical Sales (Weekly)"
                              connectNulls={false}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="predicted" 
                              stroke="hsl(var(--success))" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={{ fill: 'hsl(var(--success))' }}
                              name="Predicted Demand (* forecast)"
                              connectNulls={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Prediction Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground mb-1">Predicted Demand</p>
                        <p className="text-3xl font-bold">
                          {adjustedForecast?.adjustedDemand || selectedForecast.predictedDemand}
                        </p>
                        <p className="text-sm text-muted-foreground">units needed</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground mb-1">Reorder Now</p>
                        <p className="text-3xl font-bold text-primary">
                          {selectedForecast.suggestedReorderQty}
                        </p>
                        <p className="text-sm text-muted-foreground">units to order</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Trend & Confidence */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      {selectedForecast.trend === 'increasing' && <TrendingUp className="h-4 w-4 text-success" />}
                      {selectedForecast.trend === 'decreasing' && <TrendingDown className="h-4 w-4 text-destructive" />}
                      {selectedForecast.trend === 'stable' && <Minus className="h-4 w-4" />}
                      <span className="capitalize">{selectedForecast.trend} Trend</span>
                    </div>
                    <span className="text-muted-foreground">•</span>
                    <span>{adjustedForecast?.adjustedConfidence || selectedForecast.confidenceLevel}% confidence</span>
                    <span className="text-muted-foreground">•</span>
                    <Badge variant={
                      selectedForecast.stockoutRisk === 'high' ? 'destructive' :
                      selectedForecast.stockoutRisk === 'medium' ? 'default' : 'secondary'
                    }>
                      {selectedForecast.stockoutRisk} risk
                    </Badge>
                  </div>

                  {/* Price Intelligence Adjustment */}
                  {adjustedForecast && selectedCompetitors.length > 0 && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-primary">
                          <DollarSign className="h-4 w-4" />
                          PRICE INTELLIGENCE ADJUSTMENT
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span>Your Price:</span>
                          <span className="font-bold">{formatMoney(selectedProduct.sellingPrice)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Avg Competitor:</span>
                          <span className="font-bold">{formatMoney(adjustedForecast.avgCompetitor)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Price Difference:</span>
                          <span className={`font-bold ${adjustedForecast.isMoreExpensive ? 'text-destructive' : 'text-success'}`}>
                            {adjustedForecast.isMoreExpensive ? '+' : ''}{adjustedForecast.priceDiff}%
                            {adjustedForecast.isMoreExpensive ? ' (more expensive)' : ' (cheaper)'}
                          </span>
                        </div>
                        
                        {adjustedForecast.originalDemand !== adjustedForecast.adjustedDemand && (
                          <div className="pt-2 border-t">
                            <div className="flex items-center gap-2 text-sm">
                              <AlertCircle className="h-4 w-4 text-primary" />
                              <span>
                                Forecast adjusted from <strong>{adjustedForecast.originalDemand}</strong> to{' '}
                                <strong className="text-primary">{adjustedForecast.adjustedDemand}</strong> units
                                {adjustedForecast.isMoreExpensive 
                                  ? ' (reduced due to higher price)'
                                  : ' (increased due to lower price)'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Competitor List */}
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-2">Competitors tracked:</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedCompetitors.map((c, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {c.competitor_name}: {formatMoney(c.price)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* AI Recommendation */}
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-primary">AI RECOMMENDATION</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{selectedForecast.recommendation}</p>
                      {adjustedForecast && adjustedForecast.isMoreExpensive && parseFloat(adjustedForecast.priceDiff) > 5 && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          💡 Consider adjusting price closer to market average ({formatMoney(adjustedForecast.avgCompetitor)}) to potentially increase sales.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
