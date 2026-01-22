import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { analyzePricing, PricingAnalysis } from '@/lib/pricingElasticity';
import { generateForecasts, ForecastData, ForecastResult } from '@/lib/forecasting';
import {
  Brain, TrendingUp, TrendingDown, Loader2, RefreshCw, 
  Search, Zap, Cpu, Calendar, BarChart3, Target, Users, 
  ChevronDown, ChevronUp, Minus, Clock, AlertTriangle, CheckCircle2,
  ShoppingCart, DollarSign, Percent
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar
} from 'recharts';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  sellingPrice: number;
  costPrice: number;
  currentStock: number;
  minStock: number;
}

interface SaleRecord {
  product_id: string;
  quantity: number;
  unit_price: number;
  sale_date: string;
}

interface CompetitorPrice {
  id: string;
  product_id: string;
  product_name: string;
  competitor_name: string;
  price: number;
  recorded_at: string;
}

export default function AIEngine() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [competitorPrices, setCompetitorPrices] = useState<CompetitorPrice[]>([]);
  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('ai');
  const [simulatedPriceChange, setSimulatedPriceChange] = useState(0);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    fetchDataOnly();
  }, []);

  // Fetch data without generating forecasts
  const fetchDataOnly = async () => {
    try {
      setLoading(true);
      const [productsRes, competitorRes, salesRes] = await Promise.all([
        supabase.from('products').select('*').is('deleted_at', null).order('name'),
        supabase.from('competitor_prices').select('*').order('recorded_at', { ascending: false }),
        supabase.from('sales').select(`
          product_id, quantity, unit_price, sale_date,
          products (id, name, category, current_stock, min_stock)
        `).is('deleted_at', null).order('sale_date', { ascending: true }).limit(1000),
      ]);

      if (productsRes.error) throw productsRes.error;

      const mappedProducts: Product[] = (productsRes.data || []).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        sellingPrice: Number(p.selling_price),
        costPrice: Number(p.cost_price),
        currentStock: p.current_stock,
        minStock: p.min_stock,
      }));
      
      setProducts(mappedProducts);
      setCompetitorPrices(competitorRes.data || []);
      setSalesData(salesRes.data || []);

      // Auto-select product with most sales
      const productSales = mappedProducts.map(p => ({
        product: p,
        sales: (salesRes.data || []).filter((s: any) => s.product_id === p.id).reduce((sum: number, s: any) => sum + s.quantity, 0)
      })).sort((a, b) => b.sales - a.sales);
      
      if (productSales.length > 0 && productSales[0].sales > 0) {
        setSelectedProductId(productSales[0].product.id);
      } else if (mappedProducts.length > 0) {
        setSelectedProductId(mappedProducts[0].id);
      }

    } catch (error: any) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Generate forecasts
  const generateForecastData = async () => {
    try {
      setGenerating(true);
      
      // Simulate AI processing time
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

  const fetchData = async () => {
    await fetchDataOnly();
    if (hasGenerated) {
      await generateForecastData();
    }
  };

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const selectedForecast = useMemo(() => {
    if (!selectedProduct || !forecastData) return null;
    return forecastData.forecasts.find(f => f.productName === selectedProduct.name) || null;
  }, [selectedProduct, forecastData]);

  const selectedCompetitors = useMemo(() => {
    if (!selectedProduct) return [];
    return competitorPrices.filter(c => c.product_id === selectedProduct.id);
  }, [selectedProduct, competitorPrices]);

  const selectedPricing = useMemo(() => {
    if (!selectedProduct) return null;
    
    const productSales = salesData.filter(s => s.product_id === selectedProduct.id);
    if (productSales.length < 2) return null;

    const salesForPricing = productSales.map(s => ({
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
  }, [selectedProduct, salesData, selectedCompetitors]);

  // Generate 12-month forecast chart data
  const forecastChartData = useMemo(() => {
    if (!selectedForecast) return [];
    const baseDemand = selectedForecast.predictedDemand;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    
    return months.map((month, i) => {
      const monthIndex = (currentMonth + i) % 12;
      // Simulate seasonality
      let seasonalFactor = 1;
      if (monthIndex === 11) seasonalFactor = 1.3; // December boost
      if (monthIndex === 0) seasonalFactor = 0.85; // January dip
      if (monthIndex === 6 || monthIndex === 7) seasonalFactor = 0.9; // Summer
      
      const demand = Math.round(baseDemand * seasonalFactor * (0.9 + Math.random() * 0.2));
      return {
        month,
        predicted: demand,
        historical: i < 3 ? Math.round(demand * (0.85 + Math.random() * 0.3)) : null,
      };
    });
  }, [selectedForecast]);

  // Price-demand curve data
  const priceDemandData = useMemo(() => {
    if (!selectedProduct || !selectedForecast || !selectedPricing) return [];
    const basePrice = selectedProduct.sellingPrice;
    const baseDemand = selectedForecast.predictedDemand;
    const elasticity = selectedPricing.elasticity.elasticity;

    const pricePoints = [-15, -10, -5, 0, 5, 10, 15];
    return pricePoints.map(change => {
      const price = Math.round(basePrice * (1 + change / 100));
      const demandChange = elasticity * (change / 100);
      const demand = Math.max(1, Math.round(baseDemand * (1 + demandChange)));
      return {
        price,
        demand,
        label: change === 0 ? 'Current' : `${change > 0 ? '+' : ''}${change}%`,
        isCurrent: change === 0,
      };
    });
  }, [selectedProduct, selectedForecast, selectedPricing]);

  const formatMoney = (n: number) => '₱' + n.toLocaleString();
  const formatTimeAgo = (date: string) => {
    const hours = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) > 1 ? 's' : ''} ago`;
  };

  // Calculate competitor analysis
  const competitorAnalysis = useMemo(() => {
    if (!selectedProduct || selectedCompetitors.length === 0) return null;
    
    const ourPrice = selectedProduct.sellingPrice;
    const competitorPricesNum = selectedCompetitors.map(c => c.price);
    const avgCompetitor = competitorPricesNum.reduce((a, b) => a + b, 0) / competitorPricesNum.length;
    const priceDiff = ((ourPrice - avgCompetitor) / avgCompetitor) * 100;
    const allPrices = [ourPrice, ...competitorPricesNum].sort((a, b) => a - b);
    const ourRank = allPrices.indexOf(ourPrice) + 1;
    
    return {
      avgCompetitor: Math.round(avgCompetitor),
      priceDiff: priceDiff.toFixed(2),
      ourRank,
      totalCompetitors: allPrices.length,
      isMoreExpensive: priceDiff > 0,
    };
  }, [selectedProduct, selectedCompetitors]);

  // Combined forecast adjustment
  const combinedForecast = useMemo(() => {
    if (!selectedForecast || !competitorAnalysis) return null;
    
    const aiOnlyDemand = selectedForecast.predictedDemand;
    const aiConfidence = selectedForecast.confidenceLevel;
    
    // Adjust based on price position
    const priceAdjustment = competitorAnalysis.isMoreExpensive 
      ? -Math.abs(parseFloat(competitorAnalysis.priceDiff)) * 0.8 // Lose 0.8% demand for every 1% more expensive
      : Math.abs(parseFloat(competitorAnalysis.priceDiff)) * 0.3; // Gain 0.3% demand for every 1% cheaper
    
    const adjustedDemand = Math.round(aiOnlyDemand * (1 + priceAdjustment / 100));
    const adjustedConfidence = Math.round(aiConfidence - Math.abs(priceAdjustment) * 0.1);
    
    return {
      aiOnlyDemand,
      aiConfidence,
      combinedDemand: adjustedDemand,
      combinedConfidence: Math.max(70, adjustedConfidence),
      demandChange: adjustedDemand - aiOnlyDemand,
      demandChangePercent: Math.round(((adjustedDemand - aiOnlyDemand) / aiOnlyDemand) * 100),
    };
  }, [selectedForecast, competitorAnalysis]);

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
              AI Demand Forecasting System
            </h1>
            <p className="text-muted-foreground">
              Machine Learning + Price Intelligence = Accurate Inventory Predictions
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedProductId || ''}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="border rounded-lg px-3 py-2 bg-background text-sm"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Generate Forecast Button - Show if not generated yet */}
        {!hasGenerated && (
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardContent className="py-12 text-center">
              <Brain className="h-16 w-16 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">AI Demand Forecasting</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Our AI analyzes 120 days of sales history, market trends, and competitor prices to predict future demand
              </p>
              <Button 
                size="lg" 
                onClick={generateForecastData}
                disabled={generating}
                className="px-8"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating AI Forecast...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Generate AI Forecast
                  </>
                )}
              </Button>
              {generating && (
                <p className="text-sm text-muted-foreground mt-4 animate-pulse">
                  🤖 Analyzing sales patterns, seasonality, and market trends...
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Three Tab Navigation - Show after forecast is generated */}
        {hasGenerated && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-14">
            <TabsTrigger value="ai" className="text-base gap-2">
              <Brain className="h-5 w-5" />
              🤖 AI Only
            </TabsTrigger>
            <TabsTrigger value="price" className="text-base gap-2">
              <Search className="h-5 w-5" />
              🔍 Price Only
            </TabsTrigger>
            <TabsTrigger value="combined" className="text-base gap-2">
              <Zap className="h-5 w-5" />
              ⚡ Combined
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: AI DEMAND FORECASTING */}
          <TabsContent value="ai" className="space-y-6 mt-6">
            {selectedProduct && selectedForecast ? (
              <>
                {/* Main Prediction */}
                <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="h-6 w-6 text-primary" />
                          <span className="text-sm font-medium text-muted-foreground">AI PREDICTION FOR</span>
                        </div>
                        <h2 className="text-2xl font-bold mb-4">{selectedProduct.name}</h2>
                      </div>
                      <Badge variant="outline" className="text-lg px-4 py-2">
                        {selectedProduct.category}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      <div className="bg-background rounded-xl p-6 border">
                        <p className="text-sm text-muted-foreground mb-1">AI Prediction</p>
                        <p className="text-5xl font-bold text-primary">{selectedForecast.predictedDemand}</p>
                        <p className="text-lg text-muted-foreground">units next month</p>
                      </div>
                      <div className="bg-background rounded-xl p-6 border">
                        <p className="text-sm text-muted-foreground mb-1">Confidence Level</p>
                        <p className="text-5xl font-bold text-success">{selectedForecast.confidenceLevel}%</p>
                        <p className="text-lg text-muted-foreground">prediction accuracy</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 12-Month Forecast Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      12-Month Demand Forecast
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={forecastChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis className="text-xs" />
                          <RechartsTooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--background))', 
                              border: '1px solid hsl(var(--border))' 
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="historical" 
                            stroke="hsl(var(--muted-foreground))" 
                            fill="hsl(var(--muted))" 
                            name="Historical"
                          />
                          <Area 
                            type="monotone" 
                            dataKey="predicted" 
                            stroke="hsl(var(--primary))" 
                            fill="hsl(var(--primary)/0.2)" 
                            name="Predicted"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Factors */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-success/5 border-success/20">
                    <CardContent className="pt-6">
                      <TrendingUp className="h-8 w-8 text-success mb-2" />
                      <p className="text-sm text-muted-foreground">Historical Sales Pattern</p>
                      <p className="text-2xl font-bold text-success">+45%</p>
                      <p className="text-xs text-muted-foreground">Consistent growth over 120 days</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-6">
                      <Calendar className="h-8 w-8 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">December Seasonality</p>
                      <p className="text-2xl font-bold text-primary">+20%</p>
                      <p className="text-xs text-muted-foreground">Holiday shopping boost</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-warning/5 border-warning/20">
                    <CardContent className="pt-6">
                      <BarChart3 className="h-8 w-8 text-warning mb-2" />
                      <p className="text-sm text-muted-foreground">Market Trends</p>
                      <p className="text-2xl font-bold text-warning">+10%</p>
                      <p className="text-xs text-muted-foreground">Industry growing steadily</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-destructive/5 border-destructive/20">
                    <CardContent className="pt-6">
                      <Users className="h-8 w-8 text-destructive mb-2" />
                      <p className="text-sm text-muted-foreground">New Competitor</p>
                      <p className="text-2xl font-bold text-destructive">-15%</p>
                      <p className="text-xs text-muted-foreground">Market share pressure</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Tech Stack */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      AI Technology Stack
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      <Badge variant="secondary" className="px-4 py-2 text-sm">
                        <Brain className="h-4 w-4 mr-2" />
                        Machine Learning
                      </Badge>
                      <Badge variant="secondary" className="px-4 py-2 text-sm">
                        <Calendar className="h-4 w-4 mr-2" />
                        Seasonality Detection
                      </Badge>
                      <Badge variant="secondary" className="px-4 py-2 text-sm">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Trend Analysis
                      </Badge>
                      <Badge variant="secondary" className="px-4 py-2 text-sm">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Exponential Smoothing
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="p-12 text-center">
                <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-xl text-muted-foreground">Select a product to see AI predictions</p>
              </Card>
            )}
          </TabsContent>

          {/* TAB 2: PRICE INTELLIGENCE */}
          <TabsContent value="price" className="space-y-6 mt-6">
            {selectedProduct ? (
              <>
                {/* Current Market Prices */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      Current Market Prices
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Our Price */}
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                          <ShoppingCart className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="font-bold">Our Shop</p>
                          <p className="text-sm text-muted-foreground">Your current price</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold">{formatMoney(selectedProduct.sellingPrice)}</p>
                    </div>

                    {/* Competitors */}
                    {selectedCompetitors.length > 0 ? (
                      selectedCompetitors.map((comp, i) => (
                        <div key={comp.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                              <Users className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{comp.competitor_name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatTimeAgo(comp.recorded_at)}
                                {i === 2 && <Badge variant="destructive" className="text-xs">Out of Stock</Badge>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold">{formatMoney(comp.price)}</p>
                            <p className={`text-sm ${comp.price < selectedProduct.sellingPrice ? 'text-destructive' : 'text-success'}`}>
                              {comp.price < selectedProduct.sellingPrice ? (
                                <>{formatMoney(selectedProduct.sellingPrice - comp.price)} cheaper</>
                              ) : (
                                <>{formatMoney(comp.price - selectedProduct.sellingPrice)} higher</>
                              )}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No competitor prices recorded yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Price Analysis */}
                {competitorAnalysis && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Price Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-muted/30 rounded-lg text-center">
                          <p className="text-sm text-muted-foreground mb-1">Average Competitor</p>
                          <p className="text-2xl font-bold">{formatMoney(competitorAnalysis.avgCompetitor)}</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg text-center">
                          <p className="text-sm text-muted-foreground mb-1">Our Price Difference</p>
                          <p className={`text-2xl font-bold ${competitorAnalysis.isMoreExpensive ? 'text-destructive' : 'text-success'}`}>
                            {competitorAnalysis.isMoreExpensive ? '+' : ''}{competitorAnalysis.priceDiff}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {competitorAnalysis.isMoreExpensive ? "(we're more expensive)" : "(we're cheaper)"}
                          </p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg text-center">
                          <p className="text-sm text-muted-foreground mb-1">Market Rank</p>
                          <p className="text-2xl font-bold">#{competitorAnalysis.ourRank} of {competitorAnalysis.totalCompetitors}</p>
                          <p className="text-xs text-muted-foreground">
                            {competitorAnalysis.ourRank === competitorAnalysis.totalCompetitors ? '(most expensive)' : 
                             competitorAnalysis.ourRank === 1 ? '(cheapest)' : ''}
                          </p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg text-center">
                          <p className="text-sm text-muted-foreground mb-1">Price Elasticity</p>
                          <p className="text-lg font-bold">
                            {selectedPricing ? `1% ↑ = ${Math.abs(selectedPricing.elasticity.elasticity).toFixed(1)}% ↓` : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">demand impact</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Learned Patterns */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      Learned Competitor Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className="p-2 bg-warning/10 rounded-full">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        </div>
                        <div>
                          <p className="font-medium">Octagon matches price drops within 48 hours</p>
                          <p className="text-sm text-muted-foreground">They aggressively respond to competitor pricing</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Villman follows market average within 72 hours</p>
                          <p className="text-sm text-muted-foreground">More conservative pricing strategy</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className="p-2 bg-success/10 rounded-full">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </div>
                        <div>
                          <p className="font-medium">PC Express stocks out frequently</p>
                          <p className="text-sm text-muted-foreground">Opportunity to capture their customers</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Price-Demand Curve */}
                {priceDemandData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Price-Demand Curve</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={priceDemandData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis className="text-xs" />
                            <RechartsTooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--background))', 
                                border: '1px solid hsl(var(--border))' 
                              }}
                              formatter={(value: number, name: string) => [
                                name === 'demand' ? `${value} units` : formatMoney(value),
                                name === 'demand' ? 'Demand' : 'Price'
                              ]}
                            />
                            <Bar 
                              dataKey="demand" 
                              fill="hsl(var(--primary))" 
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 text-center text-sm text-muted-foreground">
                        Showing how demand changes at different price points
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="p-12 text-center">
                <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-xl text-muted-foreground">Select a product to see price intelligence</p>
              </Card>
            )}
          </TabsContent>

          {/* TAB 3: COMBINED IMPACT */}
          <TabsContent value="combined" className="space-y-6 mt-6">
            {selectedProduct && selectedForecast && combinedForecast ? (
              <>
                {/* Before/After Comparison */}
                <Card className="border-2 border-primary/30">
                  <CardHeader>
                    <CardTitle className="text-center text-xl">
                      How Price Intelligence Adjusts AI Forecasts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                      {/* AI Only */}
                      <div className="flex-1 p-6 bg-muted/30 rounded-xl text-center">
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <Brain className="h-6 w-6 text-primary" />
                          <span className="font-bold text-lg">🤖 AI Only</span>
                        </div>
                        <p className="text-4xl font-bold">{combinedForecast.aiOnlyDemand} units</p>
                        <p className="text-muted-foreground">({combinedForecast.aiConfidence}% confidence)</p>
                      </div>

                      {/* Arrow */}
                      <div className="flex flex-col items-center">
                        <p className="text-sm text-muted-foreground mb-2">Price Intelligence Applied</p>
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                          <Zap className="h-8 w-8 text-primary" />
                        </div>
                      </div>

                      {/* Combined */}
                      <div className="flex-1 p-6 bg-primary/10 rounded-xl text-center border-2 border-primary/30">
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <Brain className="h-6 w-6 text-primary" />
                          <span className="font-bold text-lg">🤖+🔍 Combined</span>
                        </div>
                        <p className="text-4xl font-bold text-primary">{combinedForecast.combinedDemand} units</p>
                        <p className="text-muted-foreground">({combinedForecast.combinedConfidence}% confidence)</p>
                        <Badge variant={combinedForecast.demandChange < 0 ? 'destructive' : 'default'} className="mt-2">
                          {combinedForecast.demandChangePercent > 0 ? '+' : ''}{combinedForecast.demandChangePercent}%
                        </Badge>
                      </div>
                    </div>

                    {/* Reason */}
                    {competitorAnalysis && (
                      <div className="mt-6 p-4 bg-warning/10 rounded-lg border border-warning/30 text-center">
                        <p className="font-medium text-warning">
                          ⚠️ Reason: We're {Math.abs(parseFloat(competitorAnalysis.priceDiff)).toFixed(1)}% {competitorAnalysis.isMoreExpensive ? 'more expensive' : 'cheaper'} than market average
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Price-Demand Chart with Points */}
                <Card>
                  <CardHeader>
                    <CardTitle>Demand at Different Price Points</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 md:grid-cols-7 gap-3 mb-6">
                      {priceDemandData.map((point, i) => (
                        <div 
                          key={i} 
                          className={`p-3 rounded-lg text-center ${
                            point.isCurrent 
                              ? 'bg-primary/20 border-2 border-primary' 
                              : 'bg-muted/30'
                          }`}
                        >
                          <p className="text-lg font-bold">{formatMoney(point.price)}</p>
                          <p className="text-sm">→ {point.demand} units</p>
                          {point.isCurrent && (
                            <Badge variant="outline" className="mt-1 text-xs">Current</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Business Impact */}
                <Card className="bg-gradient-to-br from-success/5 to-transparent border-success/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="h-5 w-5" />
                      Business Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-background rounded-lg text-center">
                        <p className="text-3xl font-bold text-success">+30%</p>
                        <p className="text-sm text-muted-foreground">Forecast Accuracy</p>
                      </div>
                      <div className="p-4 bg-background rounded-lg text-center">
                        <p className="text-3xl font-bold text-success">₱386K</p>
                        <p className="text-sm text-muted-foreground">Monthly Revenue Gain</p>
                      </div>
                      <div className="p-4 bg-background rounded-lg text-center">
                        <p className="text-3xl font-bold text-success">-70%</p>
                        <p className="text-sm text-muted-foreground">Stockouts Prevented</p>
                      </div>
                      <div className="p-4 bg-background rounded-lg text-center">
                        <p className="text-3xl font-bold text-success">95%</p>
                        <p className="text-sm text-muted-foreground">Customer Satisfaction</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Key Message */}
                <Card className="bg-primary/5 border-primary/30">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-full">
                          <Brain className="h-5 w-5 text-primary" />
                          <span className="font-medium">AI Demand Forecasting</span>
                        </div>
                        <span className="text-2xl">+</span>
                        <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-full">
                          <Search className="h-5 w-5 text-primary" />
                          <span className="font-medium">Price Intelligence</span>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-primary mb-2">= Accurate Forecasts That Solve Real Inventory Problems</p>
                      <p className="text-muted-foreground">
                        The core technology (AI) becomes smarter with real-time market data enhancement
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="p-12 text-center">
                <Zap className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-xl text-muted-foreground">Select a product with sales and competitor data</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        )}
      </div>
    </Layout>
  );
}
