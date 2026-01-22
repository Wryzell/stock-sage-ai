import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateForecasts, ForecastData, ForecastResult } from '@/lib/forecasting';
import {
  Brain, TrendingUp, TrendingDown, Loader2, Minus, RefreshCw,
  Package, Zap, ChevronRight, BarChart3, AlertTriangle, CheckCircle
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  sellingPrice: number;
  currentStock: number;
  minStock: number;
}

export default function AIEngine() {
  const [products, setProducts] = useState<Product[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, salesRes] = await Promise.all([
        supabase.from('products').select('*').is('deleted_at', null).order('name'),
        supabase.from('sales').select(`
          product_id, quantity, unit_price, sale_date,
          products (id, name, category, current_stock, min_stock)
        `).is('deleted_at', null).order('sale_date', { ascending: true }).limit(1000),
      ]);

      if (productsRes.error) throw productsRes.error;

      const mappedProducts: Product[] = (productsRes.data || []).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        sellingPrice: Number(p.selling_price),
        currentStock: p.current_stock,
        minStock: p.min_stock,
      }));
      
      setProducts(mappedProducts);
      setSalesData(salesRes.data || []);

    } catch (error: any) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const generateForecast = async () => {
    try {
      setGenerating(true);
      
      // Simulate AI processing
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
      
      // Auto-select first product with forecast
      if (forecasts.forecasts.length > 0) {
        const firstProduct = products.find(p => p.name === forecasts.forecasts[0].productName);
        if (firstProduct) setSelectedProductId(firstProduct.id);
      }

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

  // Get products with sales data
  const productsWithSales = useMemo(() => {
    return products.map(p => {
      const productSales = salesData.filter((s: any) => s.product_id === p.id);
      const totalSold = productSales.reduce((sum: number, s: any) => sum + s.quantity, 0);
      const forecast = forecastData?.forecasts.find(f => f.productName === p.name);
      return { ...p, totalSold, forecast };
    }).sort((a, b) => b.totalSold - a.totalSold);
  }, [products, salesData, forecastData]);

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
              AI Demand Forecasting
            </h1>
            <p className="text-muted-foreground">
              Predict future demand using machine learning
            </p>
          </div>
          {hasGenerated && (
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          )}
        </div>

        {/* Generate Forecast Button */}
        {!hasGenerated && (
          <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">AI Demand Forecasting</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Our AI will analyze 120 days of sales history to predict how many units you'll sell next month
              </p>
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
                <div className="mt-6 space-y-2">
                  <p className="text-sm text-muted-foreground animate-pulse">
                    🤖 Analyzing sales patterns...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* After Generation: Product List + Forecast */}
        {hasGenerated && forecastData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Product List */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Products
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {forecastData.forecasts.length} products analyzed
                </p>
              </CardHeader>
              <ScrollArea className="h-[500px]">
                <div className="px-4 pb-4 space-y-2">
                  {productsWithSales.filter(p => p.forecast).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProductId(p.id)}
                      className={`w-full text-left p-4 rounded-lg transition-all ${
                        selectedProductId === p.id
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className={`text-sm ${selectedProductId === p.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {p.totalSold} units sold
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.forecast && (
                            <Badge variant={selectedProductId === p.id ? 'secondary' : 'outline'} className="text-xs">
                              {p.forecast.predictedDemand} predicted
                            </Badge>
                          )}
                          <ChevronRight className="h-4 w-4 opacity-50" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>

            {/* Forecast Display */}
            <div className="lg:col-span-2 space-y-4">
              {selectedProduct && selectedForecast ? (
                <>
                  {/* Product Header */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="outline" className="mb-2">{selectedProduct.category}</Badge>
                          <h2 className="text-2xl font-bold">{selectedProduct.name}</h2>
                          <p className="text-muted-foreground">
                            Current Stock: {selectedProduct.currentStock} units
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Price</p>
                          <p className="text-xl font-bold">{formatMoney(selectedProduct.sellingPrice)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* AI Prediction */}
                  <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        AI Prediction
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="text-center p-6 bg-background rounded-xl border">
                          <p className="text-sm text-muted-foreground mb-2">Predicted Demand</p>
                          <p className="text-5xl font-bold text-primary">{selectedForecast.predictedDemand}</p>
                          <p className="text-muted-foreground">units next month</p>
                        </div>
                        <div className="text-center p-6 bg-background rounded-xl border">
                          <p className="text-sm text-muted-foreground mb-2">Confidence Level</p>
                          <p className="text-5xl font-bold text-success">{selectedForecast.confidenceLevel}%</p>
                          <p className="text-muted-foreground">accuracy</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trend */}
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        {selectedForecast.trend === 'increasing' && (
                          <>
                            <div className="p-3 bg-success/10 rounded-full">
                              <TrendingUp className="h-6 w-6 text-success" />
                            </div>
                            <div>
                              <p className="font-semibold text-lg text-success">📈 Demand Going UP</p>
                              <p className="text-muted-foreground">Sales are increasing - consider stocking more</p>
                            </div>
                          </>
                        )}
                        {selectedForecast.trend === 'decreasing' && (
                          <>
                            <div className="p-3 bg-destructive/10 rounded-full">
                              <TrendingDown className="h-6 w-6 text-destructive" />
                            </div>
                            <div>
                              <p className="font-semibold text-lg text-destructive">📉 Demand Going DOWN</p>
                              <p className="text-muted-foreground">Sales are decreasing - be careful with stock</p>
                            </div>
                          </>
                        )}
                        {selectedForecast.trend === 'stable' && (
                          <>
                            <div className="p-3 bg-muted rounded-full">
                              <Minus className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="font-semibold text-lg">➡️ Demand is Stable</p>
                              <p className="text-muted-foreground">Sales are consistent</p>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recommendation */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        AI Recommendation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-lg">{selectedForecast.recommendation}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* Stockout Risk */}
                        <div className={`p-4 rounded-lg ${
                          selectedForecast.stockoutRisk === 'high' ? 'bg-destructive/10 border border-destructive/30' :
                          selectedForecast.stockoutRisk === 'medium' ? 'bg-warning/10 border border-warning/30' :
                          'bg-success/10 border border-success/30'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className={`h-4 w-4 ${
                              selectedForecast.stockoutRisk === 'high' ? 'text-destructive' :
                              selectedForecast.stockoutRisk === 'medium' ? 'text-warning' :
                              'text-success'
                            }`} />
                            <p className="font-medium">Stockout Risk</p>
                          </div>
                          <p className={`text-2xl font-bold capitalize ${
                            selectedForecast.stockoutRisk === 'high' ? 'text-destructive' :
                            selectedForecast.stockoutRisk === 'medium' ? 'text-warning' :
                            'text-success'
                          }`}>
                            {selectedForecast.stockoutRisk}
                          </p>
                        </div>

                        {/* Suggested Reorder */}
                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="h-4 w-4 text-primary" />
                            <p className="font-medium">Suggested Reorder</p>
                          </div>
                          <p className="text-2xl font-bold text-primary">
                            {selectedForecast.suggestedReorderQty} units
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="h-full flex items-center justify-center min-h-[400px]">
                  <CardContent className="text-center">
                    <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-xl text-muted-foreground">Select a product to see forecast</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
