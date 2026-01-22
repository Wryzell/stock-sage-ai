import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { analyzePricing, PricingAnalysis } from '@/lib/pricingElasticity';
import { generateForecasts, ForecastData, ForecastResult } from '@/lib/forecasting';
import {
  Brain, TrendingUp, TrendingDown, Loader2, Minus, RefreshCw, 
  ShoppingCart, DollarSign, Target, ChevronRight
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

interface SaleRecord {
  product_id: string;
  quantity: number;
  unit_price: number;
  sale_date: string;
}

interface CompetitorPrice {
  id: string;
  product_id: string;
  competitor_name: string;
  price: number;
}

interface Analysis {
  product: Product;
  forecast: ForecastResult | null;
  pricing: PricingAnalysis | null;
  competitors: CompetitorPrice[];
  totalSold: number;
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
    fetchData();
  }, []);

  const fetchData = async () => {
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

      // Auto-select first product with sales
      const productWithMostSales = mappedProducts.find(p => 
        (salesRes.data || []).some((s: any) => s.product_id === p.id)
      );
      if (productWithMostSales) setSelectedProduct(productWithMostSales);
      else if (mappedProducts.length > 0) setSelectedProduct(mappedProducts[0]);

    } catch (error: any) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Build analysis for each product
  const analyses: Analysis[] = useMemo(() => {
    return products.map(product => {
      const forecast = forecastData?.forecasts.find(f => f.productName === product.name) || null;
      
      const competitors = competitorPrices.filter(c => c.product_id === product.id);

      const productSales = salesData.filter(s => s.product_id === product.id);
      const totalSold = productSales.reduce((sum, s) => sum + s.quantity, 0);

      const salesForPricing = productSales.map(s => ({
        productId: s.product_id,
        quantity: s.quantity,
        unitPrice: Number(s.unit_price),
        saleDate: s.sale_date,
      }));

      const competitorData = competitors.map(c => ({
        competitorName: c.competitor_name,
        price: Number(c.price),
      }));

      const pricing = salesForPricing.length >= 2
        ? analyzePricing(product.id, product.name, product.sellingPrice, product.costPrice, salesForPricing, competitorData)
        : null;

      return { product, forecast, pricing, competitors, totalSold };
    }).sort((a, b) => b.totalSold - a.totalSold);
  }, [products, forecastData, competitorPrices, salesData]);

  const selected = useMemo(() => {
    if (!selectedProduct) return null;
    return analyses.find(a => a.product.id === selectedProduct.id) || null;
  }, [selectedProduct, analyses]);

  // Calculate what happens at different prices
  const whatIf = useMemo(() => {
    if (!selected?.pricing) return null;
    const { currentPrice, elasticity } = selected.pricing;
    const baseDemand = selected.forecast?.predictedDemand || 10;
    
    const newPrice = Math.round(currentPrice * (1 + priceChange[0] / 100));
    const demandChange = elasticity.elasticity * (priceChange[0] / 100);
    const newDemand = Math.max(1, Math.round(baseDemand * (1 + demandChange)));
    const newRevenue = newPrice * newDemand;
    const currentRevenue = currentPrice * baseDemand;
    const revenueDiff = newRevenue - currentRevenue;
    
    return { newPrice, newDemand, newRevenue, revenueDiff };
  }, [selected, priceChange]);

  const formatMoney = (n: number) => '₱' + n.toLocaleString();

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
              AI Engine
            </h1>
            <p className="text-muted-foreground">
              Predicts how many you'll sell and what price is best
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product List */}
          <Card>
            <div className="p-4 border-b">
              <h2 className="font-semibold">Pick a Product</h2>
              <p className="text-sm text-muted-foreground">Click to see AI predictions</p>
            </div>
            <ScrollArea className="h-[550px]">
              <div className="p-2 space-y-1">
                {analyses.filter(a => a.totalSold > 0).map(a => (
                  <button
                    key={a.product.id}
                    onClick={() => { setSelectedProduct(a.product); setPriceChange([0]); }}
                    className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                      selectedProduct?.id === a.product.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-medium truncate">{a.product.name}</p>
                      <p className={`text-sm ${selectedProduct?.id === a.product.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {a.totalSold} sold • {formatMoney(a.product.sellingPrice)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </button>
                ))}
                {analyses.filter(a => a.totalSold === 0).length > 0 && (
                  <div className="pt-4 pb-2 px-3">
                    <p className="text-xs text-muted-foreground uppercase">No Sales Yet</p>
                  </div>
                )}
                {analyses.filter(a => a.totalSold === 0).map(a => (
                  <button
                    key={a.product.id}
                    onClick={() => { setSelectedProduct(a.product); setPriceChange([0]); }}
                    className={`w-full text-left p-3 rounded-lg transition-colors opacity-60 ${
                      selectedProduct?.id === a.product.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <p className="font-medium truncate">{a.product.name}</p>
                    <p className="text-sm text-muted-foreground">{formatMoney(a.product.sellingPrice)}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* AI Analysis */}
          <div className="lg:col-span-2 space-y-4">
            {selected ? (
              <>
                {/* Product Name */}
                <Card>
                  <CardContent className="pt-6">
                    <h2 className="text-xl font-bold mb-1">{selected.product.name}</h2>
                    <p className="text-muted-foreground">{selected.product.category} • Stock: {selected.product.currentStock}</p>
                  </CardContent>
                </Card>

                {/* Simple AI Predictions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Current Price */}
                  <Card className="bg-muted/30">
                    <CardContent className="pt-6 text-center">
                      <DollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-1">Your Price</p>
                      <p className="text-2xl font-bold">{formatMoney(selected.product.sellingPrice)}</p>
                    </CardContent>
                  </Card>

                  {/* Predicted Sales */}
                  <Card className="bg-muted/30">
                    <CardContent className="pt-6 text-center">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-1">AI Predicts You'll Sell</p>
                      <p className="text-2xl font-bold">
                        {selected.forecast?.predictedDemand || '—'} 
                        <span className="text-base font-normal text-muted-foreground"> units/month</span>
                      </p>
                    </CardContent>
                  </Card>

                  {/* Best Price */}
                  <Card className="bg-primary/10 border-primary/20">
                    <CardContent className="pt-6 text-center">
                      <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground mb-1">Best Price (AI)</p>
                      <p className="text-2xl font-bold text-primary">
                        {selected.pricing ? formatMoney(selected.pricing.optimalPrice) : '—'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Trend */}
                {selected.forecast && (
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        {selected.forecast.trend === 'increasing' && (
                          <>
                            <div className="p-2 bg-success/10 rounded-full">
                              <TrendingUp className="h-5 w-5 text-success" />
                            </div>
                            <div>
                              <p className="font-semibold text-success">Demand is Going UP 📈</p>
                              <p className="text-sm text-muted-foreground">More people are buying this product</p>
                            </div>
                          </>
                        )}
                        {selected.forecast.trend === 'decreasing' && (
                          <>
                            <div className="p-2 bg-destructive/10 rounded-full">
                              <TrendingDown className="h-5 w-5 text-destructive" />
                            </div>
                            <div>
                              <p className="font-semibold text-destructive">Demand is Going DOWN 📉</p>
                              <p className="text-sm text-muted-foreground">Fewer people are buying this product</p>
                            </div>
                          </>
                        )}
                        {selected.forecast.trend === 'stable' && (
                          <>
                            <div className="p-2 bg-muted rounded-full">
                              <Minus className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-semibold">Demand is Stable ➡️</p>
                              <p className="text-sm text-muted-foreground">Sales are consistent</p>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* What If Calculator */}
                {selected.pricing && (
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="font-bold text-lg mb-4">🧮 What If I Change The Price?</h3>
                      
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between mb-3">
                            <span className="font-medium">
                              {priceChange[0] === 0 ? 'Current Price' : 
                               priceChange[0] > 0 ? `Increase by ${priceChange[0]}%` : 
                               `Decrease by ${Math.abs(priceChange[0])}%`}
                            </span>
                            {whatIf && <span className="font-bold text-lg">{formatMoney(whatIf.newPrice)}</span>}
                          </div>
                          <Slider
                            value={priceChange}
                            onValueChange={setPriceChange}
                            min={-15}
                            max={15}
                            step={1}
                            className="py-4"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>-15% cheaper</span>
                            <span>Current</span>
                            <span>+15% higher</span>
                          </div>
                        </div>

                        {whatIf && (
                          <div className="bg-muted/50 rounded-xl p-6">
                            <p className="text-center text-lg mb-4">
                              <span className="font-bold">If you charge {formatMoney(whatIf.newPrice)}</span>
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-center">
                              <div>
                                <p className="text-3xl font-bold">{whatIf.newDemand}</p>
                                <p className="text-sm text-muted-foreground">units will sell</p>
                              </div>
                              <div>
                                <p className="text-3xl font-bold">{formatMoney(whatIf.newRevenue)}</p>
                                <p className="text-sm text-muted-foreground">total revenue</p>
                              </div>
                            </div>
                            {whatIf.revenueDiff !== 0 && (
                              <p className={`text-center mt-4 font-semibold ${whatIf.revenueDiff > 0 ? 'text-success' : 'text-destructive'}`}>
                                {whatIf.revenueDiff > 0 ? '📈' : '📉'} {formatMoney(Math.abs(whatIf.revenueDiff))} {whatIf.revenueDiff > 0 ? 'more' : 'less'} than current
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Competitors */}
                {selected.competitors.length > 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="font-bold text-lg mb-4">👀 Competitor Prices</h3>
                      <div className="space-y-2">
                        {selected.competitors.map(c => {
                          const diff = selected.product.sellingPrice - Number(c.price);
                          return (
                            <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                              <span className="font-medium">{c.competitor_name}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-bold">{formatMoney(Number(c.price))}</span>
                                <Badge variant={diff < 0 ? 'default' : diff > 500 ? 'destructive' : 'secondary'}>
                                  {diff === 0 ? 'Same' : diff < 0 ? `You're ₱${Math.abs(diff).toLocaleString()} cheaper` : `₱${diff.toLocaleString()} higher`}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Simple Recommendation */}
                {selected.pricing?.recommendation && (
                  <Card className="border-2 border-primary bg-primary/5">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary rounded-lg">
                          <Brain className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-1">💡 AI Recommendation</h3>
                          <p className="text-muted-foreground">{selected.pricing.recommendation}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <Brain className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-xl font-medium mb-2">Pick a Product</p>
                  <p className="text-muted-foreground">Select from the list to see AI predictions</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
