import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { analyzePricing, PricingAnalysis } from '@/lib/pricingElasticity';
import { generateForecasts, ForecastData, ForecastResult } from '@/lib/forecasting';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Bar, Legend
} from 'recharts';
import {
  Brain, TrendingUp, TrendingDown, Target, Globe,
  Loader2, ArrowUpRight, ArrowDownRight, Minus, Package, RefreshCw
} from 'lucide-react';

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

interface CompetitorPrice {
  id: string;
  product_id: string;
  product_name: string;
  competitor_name: string;
  price: number;
  recorded_at: string;
}

interface SaleRecord {
  product_id: string;
  quantity: number;
  unit_price: number;
  sale_date: string;
}

interface IntegratedAnalysis {
  product: Product;
  forecast: ForecastResult | null;
  pricing: PricingAnalysis | null;
  competitorPrices: CompetitorPrice[];
  opportunityScore: number;
}

export default function AIEngine() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [competitorPrices, setCompetitorPrices] = useState<CompetitorPrice[]>([]);
  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [priceChange, setPriceChange] = useState([0]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
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
      if (competitorRes.error) throw competitorRes.error;
      if (salesRes.error) throw salesRes.error;

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

      const formattedSales = (salesRes.data || [])
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

      const formattedProducts = mappedProducts.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        currentStock: p.currentStock,
        minStock: p.minStock,
      }));

      const forecasts = generateForecasts(formattedSales, formattedProducts, 30);
      setForecastData(forecasts);

      if (mappedProducts.length > 0 && !selectedProduct) {
        setSelectedProduct(mappedProducts[0]);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Generate analysis for each product
  const analyses: IntegratedAnalysis[] = useMemo(() => {
    return products.map(product => {
      const forecast = forecastData?.forecasts.find(f => f.productName === product.name) || null;
      const productCompetitorPrices = competitorPrices.filter(c => 
        c.product_id === product.id || c.product_name.toLowerCase().includes(product.name.toLowerCase().split(' ')[0])
      );

      const latestCompetitorPrices = productCompetitorPrices.reduce((acc, curr) => {
        if (!acc.find(a => a.competitor_name === curr.competitor_name)) acc.push(curr);
        return acc;
      }, [] as CompetitorPrice[]);

      const productSales = salesData
        .filter(s => s.product_id === product.id)
        .map(s => ({
          productId: s.product_id,
          quantity: s.quantity,
          unitPrice: Number(s.unit_price),
          saleDate: s.sale_date,
        }));

      const competitorData = latestCompetitorPrices.map(c => ({
        competitorName: c.competitor_name,
        price: Number(c.price),
      }));

      const pricing = productSales.length > 0 || competitorData.length > 0
        ? analyzePricing(product.id, product.name, product.sellingPrice, product.costPrice, productSales, competitorData)
        : null;

      let opportunityScore = 50;
      if (pricing) {
        const priceGap = Math.abs(pricing.optimalPrice - pricing.currentPrice) / pricing.currentPrice;
        opportunityScore += priceGap * 80;
      }
      if (forecast?.trend === 'increasing') opportunityScore += 15;
      opportunityScore = Math.min(100, Math.max(0, Math.round(opportunityScore)));

      return { product, forecast, pricing, competitorPrices: latestCompetitorPrices, opportunityScore };
    }).sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [products, forecastData, competitorPrices, salesData]);

  const selectedAnalysis = useMemo(() => {
    if (!selectedProduct) return null;
    return analyses.find(a => a.product.id === selectedProduct.id) || null;
  }, [selectedProduct, analyses]);

  // Price simulation data
  const simulationData = useMemo(() => {
    if (!selectedAnalysis?.pricing) return [];
    const { currentPrice, costPrice, elasticity } = selectedAnalysis.pricing;
    const currentDemand = selectedAnalysis.forecast?.predictedDemand || 10;

    const dataPoints = [];
    for (let change = -10; change <= 10; change += 5) {
      const price = Math.round(currentPrice * (1 + change / 100));
      const demandChange = elasticity.elasticity * (change / 100);
      const demand = Math.max(0, Math.round(currentDemand * (1 + demandChange)));
      const revenue = price * demand;
      
      dataPoints.push({
        label: `${change > 0 ? '+' : ''}${change}%`,
        price,
        demand,
        revenue,
        isCurrent: change === 0,
      });
    }
    return dataPoints;
  }, [selectedAnalysis]);

  const currentSimPoint = useMemo(() => {
    if (!selectedAnalysis?.pricing) return null;
    const { currentPrice, costPrice, elasticity } = selectedAnalysis.pricing;
    const currentDemand = selectedAnalysis.forecast?.predictedDemand || 10;
    const price = Math.round(currentPrice * (1 + priceChange[0] / 100));
    const demandChange = elasticity.elasticity * (priceChange[0] / 100);
    const demand = Math.max(0, Math.round(currentDemand * (1 + demandChange)));
    const revenue = price * demand;
    return { price, demand, revenue };
  }, [selectedAnalysis, priceChange]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);

  const getTrendIcon = (trend?: string) => {
    if (trend === 'increasing') return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend === 'decreasing') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
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
        {/* Simple Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              AI Engine
            </h1>
            <p className="text-muted-foreground text-sm">
              Smart pricing & demand predictions based on 120 days of sales
            </p>
          </div>
          <Button onClick={fetchAllData} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Products Analyzed</p>
              <p className="text-2xl font-bold">{analyses.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Sales Records</p>
              <p className="text-2xl font-bold">{salesData.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Competitor Prices</p>
              <p className="text-2xl font-bold">{competitorPrices.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Top Opportunity</p>
              <p className="text-2xl font-bold text-primary">{analyses[0]?.opportunityScore || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Products
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="p-3 space-y-1">
                  {analyses.map(a => (
                    <button
                      key={a.product.id}
                      onClick={() => { setSelectedProduct(a.product); setPriceChange([0]); }}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedProduct?.id === a.product.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{a.product.name}</span>
                        <Badge variant={selectedProduct?.id === a.product.id ? 'secondary' : 'outline'} className="text-xs">
                          {a.opportunityScore}
                        </Badge>
                      </div>
                      <div className={`flex items-center gap-2 mt-1 text-xs ${
                        selectedProduct?.id === a.product.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        <span>{formatCurrency(a.product.sellingPrice)}</span>
                        {a.forecast && (
                          <>
                            <span>•</span>
                            {getTrendIcon(a.forecast.trend)}
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Analysis Panel */}
          <div className="lg:col-span-2 space-y-4">
            {selectedAnalysis ? (
              <>
                {/* Product Info */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold">{selectedAnalysis.product.name}</h2>
                        <p className="text-sm text-muted-foreground">{selectedAnalysis.product.category}</p>
                      </div>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        Score: {selectedAnalysis.opportunityScore}
                      </Badge>
                    </div>

                    {/* Key Numbers */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Current Price</p>
                        <p className="text-lg font-bold">{formatCurrency(selectedAnalysis.product.sellingPrice)}</p>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <p className="text-xs text-muted-foreground">AI Optimal</p>
                        <p className="text-lg font-bold text-primary">
                          {selectedAnalysis.pricing ? formatCurrency(selectedAnalysis.pricing.optimalPrice) : 'N/A'}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Predicted Demand</p>
                        <p className="text-lg font-bold">
                          {selectedAnalysis.forecast?.predictedDemand || 'N/A'} <span className="text-sm font-normal">units</span>
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Trend</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getTrendIcon(selectedAnalysis.forecast?.trend)}
                          <span className="capitalize">{selectedAnalysis.forecast?.trend || 'stable'}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Recommendation */}
                <Card className="border-l-4 border-l-primary">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Brain className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1">AI Recommendation</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedAnalysis.pricing?.recommendation || 'Add more sales data to get AI recommendations.'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Price Simulator */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Price Simulator</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">Adjust Price: {priceChange[0] > 0 ? '+' : ''}{priceChange[0]}%</span>
                        {currentSimPoint && (
                          <span className="font-semibold">{formatCurrency(currentSimPoint.price)}</span>
                        )}
                      </div>
                      <Slider
                        value={priceChange}
                        onValueChange={setPriceChange}
                        min={-10}
                        max={10}
                        step={1}
                      />
                    </div>

                    {currentSimPoint && (
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="text-center p-3 bg-primary/10 rounded-lg">
                          <p className="text-xs text-muted-foreground">Price</p>
                          <p className="text-xl font-bold text-primary">{formatCurrency(currentSimPoint.price)}</p>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">Expected Sales</p>
                          <p className="text-xl font-bold">{currentSimPoint.demand}</p>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <p className="text-xl font-bold">{formatCurrency(currentSimPoint.revenue)}</p>
                        </div>
                      </div>
                    )}

                    {/* Chart */}
                    <div className="h-[200px] mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={simulationData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" fontSize={12} />
                          <YAxis yAxisId="left" tickFormatter={(v) => `₱${(v/1000).toFixed(0)}K`} fontSize={11} />
                          <YAxis yAxisId="right" orientation="right" fontSize={11} />
                          <Tooltip formatter={(value: number, name: string) => [
                            name === 'revenue' ? formatCurrency(value) : value,
                            name === 'revenue' ? 'Revenue' : 'Demand'
                          ]} />
                          <Legend />
                          <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="demand" name="Demand" stroke="#22c55e" strokeWidth={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Competitor Prices */}
                {selectedAnalysis.competitorPrices.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Competitor Prices
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedAnalysis.competitorPrices.map(cp => {
                          const diff = ((selectedAnalysis.product.sellingPrice - Number(cp.price)) / Number(cp.price)) * 100;
                          return (
                            <div key={cp.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <span className="font-medium">{cp.competitor_name}</span>
                              <div className="flex items-center gap-3">
                                <span>{formatCurrency(Number(cp.price))}</span>
                                <Badge variant={diff < 0 ? 'default' : diff > 5 ? 'destructive' : 'secondary'}>
                                  {diff > 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                                  {Math.abs(Math.round(diff))}%
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Select a product</p>
                  <p className="text-sm text-muted-foreground">Choose from the list to see AI analysis</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
