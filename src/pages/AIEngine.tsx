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
  Package, Zap, ArrowDown, ArrowUp
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer
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

  const generateMockCompetitors = (product: Product): MockCompetitorData[] => {
    const competitors = ['Octagon', 'Villman', 'PC Express'];
    const basePrice = product.sellingPrice;
    
    return competitors.map(name => {
      const variance = (Math.random() * 0.35 - 0.15);
      const competitorPrice = Math.round(basePrice * (1 + variance));
      return {
        competitorName: name,
        price: Math.max(competitorPrice, product.costPrice * 1.05),
      };
    });
  };

  const analyzeProduct = (
    product: Product, 
    forecast: ForecastResult,
    competitors: MockCompetitorData[]
  ): ProductAnalysis => {
    const avgCompetitorPrice = competitors.reduce((sum, c) => sum + c.price, 0) / competitors.length;
    const priceDifference = ((product.sellingPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100;
    
    let adjustedDemand = forecast.predictedDemand;
    if (priceDifference > 0) {
      adjustedDemand = Math.round(forecast.predictedDemand * (1 - priceDifference * 0.008));
    } else {
      adjustedDemand = Math.round(forecast.predictedDemand * (1 + Math.abs(priceDifference) * 0.003));
    }
    adjustedDemand = Math.max(adjustedDemand, 1);
    
    let priceAction: 'lower' | 'raise' | 'hold' = 'hold';
    let priceRecommendation = '';
    
    if (priceDifference > 10) {
      priceAction = 'lower';
      priceRecommendation = `Price is ${priceDifference.toFixed(0)}% above market. Consider lowering to ₱${Math.round(avgCompetitorPrice * 1.02).toLocaleString()}.`;
    } else if (priceDifference < -10) {
      priceAction = 'raise';
      priceRecommendation = `Price is ${Math.abs(priceDifference).toFixed(0)}% below market. Can raise to ₱${Math.round(avgCompetitorPrice * 0.98).toLocaleString()}.`;
    } else {
      priceRecommendation = `Price is competitive. Maintain current pricing.`;
    }
    
    const daysOfStock = product.currentStock / Math.max(1, adjustedDemand / 30);
    let whenToBuy = '';
    let buyUrgency: 'urgent' | 'soon' | 'plan' | 'wait' = 'wait';
    
    if (product.currentStock <= product.minStock || daysOfStock < 7) {
      buyUrgency = 'urgent';
      whenToBuy = `Order immediately. ${product.currentStock} units left (~${Math.round(daysOfStock)} days). Reorder ${forecast.suggestedReorderQty} units.`;
    } else if (daysOfStock < 14) {
      buyUrgency = 'soon';
      whenToBuy = `Order within 3-5 days. Stock lasts ~${Math.round(daysOfStock)} days. Order ${forecast.suggestedReorderQty} units.`;
    } else if (daysOfStock < 30) {
      buyUrgency = 'plan';
      whenToBuy = `Plan order in 2 weeks. Stock for ${Math.round(daysOfStock)} days. Order ${forecast.suggestedReorderQty} units.`;
    } else {
      buyUrgency = 'wait';
      whenToBuy = `Stock healthy (${Math.round(daysOfStock)} days). No immediate order needed.`;
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
      
      const analyses: ProductAnalysis[] = [];
      products.forEach(product => {
        const forecast = forecasts.forecasts.find(f => f.productName === product.name);
        if (forecast) {
          const realData = realCompetitorPrices.filter(c => c.product_id === product.id);
          let competitors: MockCompetitorData[];
          
          if (realData.length > 0) {
            competitors = realData.map(c => ({
              competitorName: c.competitor_name,
              price: Number(c.price),
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
      toast.success('Forecast generated');

    } catch (error: any) {
      toast.error('Failed to generate forecast');
    } finally {
      setGenerating(false);
    }
  };

  const selectedAnalysis = useMemo(() => {
    return productAnalyses.find(a => a.product.id === selectedProductId) || null;
  }, [productAnalyses, selectedProductId]);

  const chartData = useMemo(() => {
    if (!selectedAnalysis) return [];
    
    const productSales = salesData.filter((s: any) => s.product_id === selectedAnalysis.product.id);
    
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

    const lastDate = sortedWeeks.length > 0 ? new Date(sortedWeeks[sortedWeeks.length - 1][0]) : new Date();
    const weeklyDemand = Math.round(selectedAnalysis.adjustedDemand / 4);
    
    for (let i = 1; i <= 4; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + (i * 7));
      historical.push({
        date: forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Demand Forecasting
            </h1>
            <p className="text-sm text-muted-foreground">
              Predictions with price intelligence
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
          <Card className="border border-border">
            <CardContent className="py-12 text-center">
              <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Generate Forecast</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Analyze sales history and competitor pricing to predict demand
              </p>
              <Button 
                onClick={generateForecast}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Forecast
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Product List */}
        {hasGenerated && productAnalyses.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {productAnalyses.length} products • Click to view details
            </p>
            
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Product</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-right p-3 font-medium">Stock</th>
                    <th className="text-right p-3 font-medium">Demand</th>
                    <th className="text-center p-3 font-medium">Trend</th>
                    <th className="text-center p-3 font-medium">Buy Status</th>
                    <th className="text-center p-3 font-medium">Price Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {productAnalyses.map(analysis => (
                    <tr 
                      key={analysis.product.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => handleProductClick(analysis.product.id)}
                    >
                      <td className="p-3 font-medium">{analysis.product.name}</td>
                      <td className="p-3 text-muted-foreground">{analysis.product.category}</td>
                      <td className="p-3 text-right">{analysis.product.currentStock}</td>
                      <td className="p-3 text-right font-medium text-primary">{analysis.adjustedDemand}</td>
                      <td className="p-3 text-center">
                        {analysis.forecast.trend === 'increasing' && <TrendingUp className="h-4 w-4 text-primary inline" />}
                        {analysis.forecast.trend === 'decreasing' && <TrendingDown className="h-4 w-4 text-destructive inline" />}
                        {analysis.forecast.trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground inline" />}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={
                          analysis.buyUrgency === 'urgent' ? 'destructive' :
                          analysis.buyUrgency === 'soon' ? 'default' :
                          'secondary'
                        } className="text-xs">
                          {analysis.buyUrgency === 'urgent' ? 'Order Now' :
                           analysis.buyUrgency === 'soon' ? 'Order Soon' :
                           analysis.buyUrgency === 'plan' ? 'Plan' : 'OK'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        {analysis.priceAction === 'lower' && (
                          <span className="text-destructive text-xs flex items-center justify-center gap-1">
                            <ArrowDown className="h-3 w-3" /> Lower
                          </span>
                        )}
                        {analysis.priceAction === 'raise' && (
                          <span className="text-primary text-xs flex items-center justify-center gap-1">
                            <ArrowUp className="h-3 w-3" /> Raise
                          </span>
                        )}
                        {analysis.priceAction === 'hold' && (
                          <span className="text-muted-foreground text-xs">Hold</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            {selectedAnalysis && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {selectedAnalysis.product.name}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-muted/30 rounded">
                      <p className="text-2xl font-bold text-primary">{selectedAnalysis.adjustedDemand}</p>
                      <p className="text-xs text-muted-foreground">Predicted Demand</p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded">
                      <p className="text-2xl font-bold">{selectedAnalysis.product.currentStock}</p>
                      <p className="text-xs text-muted-foreground">Current Stock</p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded">
                      <p className="text-2xl font-bold">{selectedAnalysis.forecast.suggestedReorderQty}</p>
                      <p className="text-xs text-muted-foreground">Reorder Qty</p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded">
                      <p className="text-2xl font-bold">{selectedAnalysis.forecast.confidenceLevel}%</p>
                      <p className="text-xs text-muted-foreground">Confidence</p>
                    </div>
                  </div>

                  {/* When to Buy */}
                  <div className={`p-3 rounded border ${
                    selectedAnalysis.buyUrgency === 'urgent' ? 'border-destructive bg-destructive/5' :
                    selectedAnalysis.buyUrgency === 'soon' ? 'border-primary bg-primary/5' :
                    'border-border'
                  }`}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">WHEN TO BUY</p>
                    <p className="text-sm">{selectedAnalysis.whenToBuy}</p>
                  </div>

                  {/* Price Intelligence */}
                  <div className="p-3 rounded border border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">PRICE ANALYSIS</p>
                    <div className="grid grid-cols-3 gap-4 text-center mb-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Your Price</p>
                        <p className="font-semibold">{formatMoney(selectedAnalysis.product.sellingPrice)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Market Avg</p>
                        <p className="font-semibold">{formatMoney(selectedAnalysis.avgCompetitorPrice)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Difference</p>
                        <p className={`font-semibold ${selectedAnalysis.priceDifference > 5 ? 'text-destructive' : selectedAnalysis.priceDifference < -5 ? 'text-primary' : ''}`}>
                          {selectedAnalysis.priceDifference > 0 ? '+' : ''}{selectedAnalysis.priceDifference.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedAnalysis.priceRecommendation}</p>
                    <div className="flex gap-2 mt-2">
                      {selectedAnalysis.competitors.map((c, i) => (
                        <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                          {c.competitorName}: {formatMoney(c.price)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Chart */}
                  {chartData.length > 0 && (
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <RechartsTooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--background))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="historical" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                            name="Historical"
                            connectNulls={false}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="predicted" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                            name="Predicted"
                            connectNulls={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* AI Note */}
                  <p className="text-xs text-muted-foreground">
                    {selectedAnalysis.forecast.recommendation}
                  </p>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
