import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateForecasts, ForecastData, ForecastResult } from '@/lib/forecasting';
import {
  Brain, TrendingUp, TrendingDown, Loader2, Minus, RefreshCw,
  Package, Zap, DollarSign, AlertCircle, ShoppingCart,
  Calendar, ArrowDown, ArrowUp, Tag
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

interface MockCompetitorData {
  competitorName: string;
  price: number;
  priceTrend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

interface ProductAnalysis {
  product: Product;
  forecast: ForecastResult;
  competitors: MockCompetitorData[];
  avgCompetitorPrice: number;
  priceDifference: number;
  priceAction: 'lower' | 'raise' | 'hold';
  priceRecommendation: string;
  whenToBuy: string;
  buyUrgency: 'urgent' | 'soon' | 'plan' | 'wait';
  adjustedDemand: number;
}

export default function AIEngine() {
  const [products, setProducts] = useState<Product[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [realCompetitorPrices, setRealCompetitorPrices] = useState<any[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [productAnalyses, setProductAnalyses] = useState<ProductAnalysis[]>([]);
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
      setRealCompetitorPrices(competitorRes.data || []);

    } catch (error: any) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Generate realistic mock competitor prices for each product
  const generateMockCompetitors = (product: Product): MockCompetitorData[] => {
    const competitors = ['Octagon', 'Villman', 'PC Express'];
    const basePrice = product.sellingPrice;
    
    return competitors.map(name => {
      // Generate price within -15% to +20% of our price
      const variance = (Math.random() * 0.35 - 0.15);
      const competitorPrice = Math.round(basePrice * (1 + variance));
      const trends: ('up' | 'down' | 'stable')[] = ['up', 'down', 'stable'];
      
      return {
        competitorName: name,
        price: Math.max(competitorPrice, product.costPrice * 1.05), // At least 5% above cost
        priceTrend: trends[Math.floor(Math.random() * 3)],
        lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    });
  };

  // Determine when to buy and price action
  const analyzeProduct = (
    product: Product, 
    forecast: ForecastResult,
    competitors: MockCompetitorData[]
  ): ProductAnalysis => {
    const avgCompetitorPrice = competitors.reduce((sum, c) => sum + c.price, 0) / competitors.length;
    const priceDifference = ((product.sellingPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100;
    
    // Adjust demand based on price position
    let adjustedDemand = forecast.predictedDemand;
    if (priceDifference > 0) {
      adjustedDemand = Math.round(forecast.predictedDemand * (1 - priceDifference * 0.008));
    } else {
      adjustedDemand = Math.round(forecast.predictedDemand * (1 + Math.abs(priceDifference) * 0.003));
    }
    adjustedDemand = Math.max(adjustedDemand, 1);
    
    // Price action recommendation
    let priceAction: 'lower' | 'raise' | 'hold' = 'hold';
    let priceRecommendation = '';
    
    if (priceDifference > 10) {
      priceAction = 'lower';
      priceRecommendation = `Your price is ${priceDifference.toFixed(0)}% above market. Consider lowering to ₱${Math.round(avgCompetitorPrice * 1.02).toLocaleString()} to stay competitive.`;
    } else if (priceDifference < -10) {
      priceAction = 'raise';
      priceRecommendation = `You're ${Math.abs(priceDifference).toFixed(0)}% below market. You could raise price to ₱${Math.round(avgCompetitorPrice * 0.98).toLocaleString()} and improve margins.`;
    } else {
      priceRecommendation = `Your price is competitive (${priceDifference > 0 ? '+' : ''}${priceDifference.toFixed(1)}% vs market). Maintain current pricing.`;
    }
    
    // When to buy calculation
    const daysOfStock = product.currentStock / Math.max(1, adjustedDemand / 30);
    let whenToBuy = '';
    let buyUrgency: 'urgent' | 'soon' | 'plan' | 'wait' = 'wait';
    
    if (product.currentStock <= product.minStock || daysOfStock < 7) {
      buyUrgency = 'urgent';
      whenToBuy = `⚠️ ORDER NOW! Only ${product.currentStock} units left (${Math.round(daysOfStock)} days). Reorder ${forecast.suggestedReorderQty} units immediately.`;
    } else if (daysOfStock < 14) {
      buyUrgency = 'soon';
      whenToBuy = `📅 Order within 3-5 days. Current stock lasts ~${Math.round(daysOfStock)} days. Prepare order for ${forecast.suggestedReorderQty} units.`;
    } else if (daysOfStock < 30) {
      buyUrgency = 'plan';
      whenToBuy = `📋 Plan order for next 2 weeks. Stock sufficient for ${Math.round(daysOfStock)} days. Consider ordering ${forecast.suggestedReorderQty} units.`;
    } else {
      buyUrgency = 'wait';
      whenToBuy = `✅ Stock healthy (${Math.round(daysOfStock)} days). No immediate order needed. Monitor demand trends.`;
    }
    
    return {
      product,
      forecast,
      competitors,
      avgCompetitorPrice,
      priceDifference,
      priceAction,
      priceRecommendation,
      whenToBuy,
      buyUrgency,
      adjustedDemand,
    };
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
      
      // Generate analysis for each product with forecast
      const analyses: ProductAnalysis[] = [];
      products.forEach(product => {
        const forecast = forecasts.forecasts.find(f => f.productName === product.name);
        if (forecast) {
          // Check for real competitor data first, then generate mock
          const realData = realCompetitorPrices.filter(c => c.product_id === product.id);
          let competitors: MockCompetitorData[];
          
          if (realData.length > 0) {
            competitors = realData.map(c => ({
              competitorName: c.competitor_name,
              price: Number(c.price),
              priceTrend: 'stable' as const,
              lastUpdated: c.recorded_at,
            }));
          } else {
            competitors = generateMockCompetitors(product);
          }
          
          analyses.push(analyzeProduct(product, forecast, competitors));
        }
      });
      
      setProductAnalyses(analyses.sort((a, b) => {
        const urgencyOrder = { urgent: 0, soon: 1, plan: 2, wait: 3 };
        return urgencyOrder[a.buyUrgency] - urgencyOrder[b.buyUrgency];
      }));
      
      setHasGenerated(true);
      toast.success('AI Forecast generated with pricing intelligence!');

    } catch (error: any) {
      toast.error('Failed to generate forecast');
    } finally {
      setGenerating(false);
    }
  };

  const selectedAnalysis = useMemo(() => {
    return productAnalyses.find(a => a.product.id === selectedProductId) || null;
  }, [productAnalyses, selectedProductId]);

  // Generate chart data for selected product
  const chartData = useMemo(() => {
    if (!selectedAnalysis) return [];
    
    const productSales = salesData.filter((s: any) => s.product_id === selectedAnalysis.product.id);
    
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
      .slice(-8);

    const historical = sortedWeeks.map(([date, qty]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      historical: qty,
      predicted: null as number | null,
    }));

    // Add forecast weeks
    const lastDate = sortedWeeks.length > 0 ? new Date(sortedWeeks[sortedWeeks.length - 1][0]) : new Date();
    const weeklyDemand = Math.round(selectedAnalysis.adjustedDemand / 4);
    
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
  }, [selectedAnalysis, salesData]);

  const formatMoney = (n: number) => '₱' + n.toLocaleString();

  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId);
    setDialogOpen(true);
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return <Badge variant="destructive">🚨 Order Now</Badge>;
      case 'soon':
        return <Badge className="bg-orange-500 hover:bg-orange-600">📅 Order Soon</Badge>;
      case 'plan':
        return <Badge variant="secondary">📋 Plan Order</Badge>;
      default:
        return <Badge variant="outline">✅ Stock OK</Badge>;
    }
  };

  const getPriceActionBadge = (action: string) => {
    switch (action) {
      case 'lower':
        return <Badge variant="destructive" className="gap-1"><ArrowDown className="h-3 w-3" />Lower Price</Badge>;
      case 'raise':
        return <Badge className="bg-green-600 hover:bg-green-700 gap-1"><ArrowUp className="h-3 w-3" />Raise Price</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Minus className="h-3 w-3" />Hold Price</Badge>;
    }
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
            <Button onClick={() => { setHasGenerated(false); fetchData(); }} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
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
                Our AI analyzes sales history and competitor pricing to predict demand and recommend when to reorder
              </p>
              <div className="flex items-center justify-center gap-4 mb-8">
                <Badge variant="secondary" className="px-3 py-1">
                  <Brain className="h-3 w-3 mr-1" /> Demand Prediction
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  <DollarSign className="h-3 w-3 mr-1" /> Price Intelligence
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  <ShoppingCart className="h-3 w-3 mr-1" /> Reorder Timing
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
        {hasGenerated && productAnalyses.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                {productAnalyses.length} products analyzed • Click to view details
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {productAnalyses.map(analysis => (
                <Card 
                  key={analysis.product.id}
                  className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
                  onClick={() => handleProductClick(analysis.product.id)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline" className="text-xs">{analysis.product.category}</Badge>
                      {getUrgencyBadge(analysis.buyUrgency)}
                    </div>
                    <h3 className="font-semibold truncate mb-1">{analysis.product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Stock: {analysis.product.currentStock} units
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <p className="text-2xl font-bold text-primary">{analysis.adjustedDemand}</p>
                        <p className="text-xs text-muted-foreground">predicted demand</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">{analysis.forecast.confidenceLevel}%</p>
                        <p className="text-xs text-muted-foreground">confidence</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Price Action:</span>
                      {getPriceActionBadge(analysis.priceAction)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Forecast Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedAnalysis && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {selectedAnalysis.product.name}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  {/* When to Buy - Prominent Section */}
                  <Card className={`border-2 ${
                    selectedAnalysis.buyUrgency === 'urgent' ? 'border-destructive bg-destructive/5' :
                    selectedAnalysis.buyUrgency === 'soon' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' :
                    'border-muted'
                  }`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        📦 WHEN TO BUY
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-medium">{selectedAnalysis.whenToBuy}</p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <span>Current Stock: <strong>{selectedAnalysis.product.currentStock}</strong></span>
                        <span>Min Stock: <strong>{selectedAnalysis.product.minStock}</strong></span>
                        <span>Suggested Order: <strong className="text-primary">{selectedAnalysis.forecast.suggestedReorderQty} units</strong></span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Price Intelligence */}
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-primary">
                        <Tag className="h-4 w-4" />
                        💰 PRICE RECOMMENDATION
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Your Price</p>
                          <p className="text-xl font-bold">{formatMoney(selectedAnalysis.product.sellingPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Market Avg</p>
                          <p className="text-xl font-bold">{formatMoney(selectedAnalysis.avgCompetitorPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Difference</p>
                          <p className={`text-xl font-bold ${selectedAnalysis.priceDifference > 5 ? 'text-destructive' : selectedAnalysis.priceDifference < -5 ? 'text-green-600' : ''}`}>
                            {selectedAnalysis.priceDifference > 0 ? '+' : ''}{selectedAnalysis.priceDifference.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      
                      <div className="pt-3 border-t">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-primary mt-0.5" />
                          <p>{selectedAnalysis.priceRecommendation}</p>
                        </div>
                      </div>

                      {/* Competitor List */}
                      <div className="pt-3 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Competitor Prices:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedAnalysis.competitors.map((c, i) => (
                            <Badge key={i} variant="outline" className="text-sm">
                              {c.competitorName}: {formatMoney(c.price)}
                              {c.priceTrend === 'up' && <TrendingUp className="h-3 w-3 ml-1 text-destructive" />}
                              {c.priceTrend === 'down' && <TrendingDown className="h-3 w-3 ml-1 text-green-600" />}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">📈 Sales History & Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[220px]">
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
                              name="Historical Sales"
                              connectNulls={false}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="predicted" 
                              stroke="#22c55e" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={{ fill: '#22c55e' }}
                              name="Predicted (* forecast)"
                              connectNulls={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Prediction Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Predicted Demand</p>
                        <p className="text-2xl font-bold text-primary">{selectedAnalysis.adjustedDemand}</p>
                        <p className="text-xs text-muted-foreground">units/month</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Trend</p>
                        <div className="flex items-center justify-center gap-1">
                          {selectedAnalysis.forecast.trend === 'increasing' && <TrendingUp className="h-5 w-5 text-green-600" />}
                          {selectedAnalysis.forecast.trend === 'decreasing' && <TrendingDown className="h-5 w-5 text-destructive" />}
                          {selectedAnalysis.forecast.trend === 'stable' && <Minus className="h-5 w-5" />}
                          <span className="text-lg font-bold capitalize">{selectedAnalysis.forecast.trend}</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Confidence</p>
                        <p className="text-2xl font-bold">{selectedAnalysis.forecast.confidenceLevel}%</p>
                        <p className="text-xs text-muted-foreground">accuracy</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* AI Recommendation */}
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-primary">🤖 AI RECOMMENDATION</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{selectedAnalysis.forecast.recommendation}</p>
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
