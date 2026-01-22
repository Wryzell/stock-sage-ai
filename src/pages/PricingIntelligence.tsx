import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { analyzePricing, PricingAnalysis } from '@/lib/pricingElasticity';
import { generateForecasts, ForecastData, ForecastResult } from '@/lib/forecasting';
import { scrapeCompetitorPrices, saveScrapedPrices } from '@/lib/api/competitorScraper';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceLine, AreaChart, Area, ComposedChart
} from 'recharts';
import {
  Brain, TrendingUp, TrendingDown, DollarSign, Target, Globe, RefreshCw,
  Loader2, AlertTriangle, CheckCircle, Lightbulb, ArrowRight, ArrowUpRight,
  ArrowDownRight, Minus, Package, Zap, BarChart3, Activity, Eye, Sparkles
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
  revenueImpact: number;
}

export default function PricingIntelligence() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [products, setProducts] = useState<Product[]>([]);
  const [competitorPrices, setCompetitorPrices] = useState<CompetitorPrice[]>([]);
  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScrapingPrices, setIsScrapingPrices] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [simulatedPriceChange, setSimulatedPriceChange] = useState([0]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Parallel fetch all data
      const [productsRes, competitorRes, salesRes] = await Promise.all([
        supabase.from('products').select('*').is('deleted_at', null).order('name'),
        supabase.from('competitor_prices').select('*').order('recorded_at', { ascending: false }),
        supabase.from('sales').select(`
          product_id, quantity, unit_price, sale_date,
          products (id, name, category, current_stock, min_stock)
        `).is('deleted_at', null).order('sale_date', { ascending: true }).limit(500),
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

      // Generate forecasts
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
      toast.error('Failed to load intelligence data');
    } finally {
      setLoading(false);
    }
  };

  // Scrape latest competitor prices via Firecrawl
  const handleScrapeCompetitorPrices = async () => {
    if (!isAdmin) return;
    setIsScrapingPrices(true);
    try {
      const productsToScrape = products.slice(0, 10).map(p => ({
        id: p.id,
        name: p.name,
      }));

      const result = await scrapeCompetitorPrices(productsToScrape);
      
      if (result.success && result.data.length > 0) {
        const saveResult = await saveScrapedPrices(result.data, user?.id);
        if (saveResult.success) {
          toast.success(`Scraped ${result.data.length} prices, saved ${saveResult.saved}`);
          fetchAllData();
        }
      } else {
        toast.info('No new prices found');
      }
    } catch (error) {
      console.error('Scrape error:', error);
      toast.error('Failed to scrape competitor prices');
    } finally {
      setIsScrapingPrices(false);
    }
  };

  // Generate integrated analysis for each product
  const integratedAnalyses: IntegratedAnalysis[] = useMemo(() => {
    return products.map(product => {
      // Get forecast for this product
      const forecast = forecastData?.forecasts.find(f => f.productName === product.name) || null;

      // Get competitor prices
      const productCompetitorPrices = competitorPrices.filter(c => 
        c.product_id === product.id || c.product_name.toLowerCase() === product.name.toLowerCase()
      );

      // Get unique latest competitor prices
      const latestCompetitorPrices = productCompetitorPrices.reduce((acc, curr) => {
        const existing = acc.find(a => a.competitor_name === curr.competitor_name);
        if (!existing) acc.push(curr);
        return acc;
      }, [] as CompetitorPrice[]);

      // Calculate pricing analysis
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

      // Calculate opportunity score (0-100)
      let opportunityScore = 50;
      if (pricing) {
        const priceGap = Math.abs(pricing.optimalPrice - pricing.currentPrice) / pricing.currentPrice;
        opportunityScore += priceGap * 100;
        if (pricing.competitorPrices.length > 0) {
          const avgCompDiff = pricing.competitorPrices.reduce((sum, c) => sum + c.percentageDifference, 0) / pricing.competitorPrices.length;
          if (avgCompDiff < -5) opportunityScore += 15; // We're cheaper
          if (avgCompDiff > 10) opportunityScore -= 10; // We're expensive
        }
      }
      if (forecast && forecast.trend === 'increasing') opportunityScore += 10;
      opportunityScore = Math.min(100, Math.max(0, Math.round(opportunityScore)));

      // Calculate potential revenue impact
      let revenueImpact = 0;
      if (pricing && forecast) {
        const currentRevenue = product.sellingPrice * (forecast.predictedDemand || 10);
        const optimalRevenue = pricing.expectedRevenue;
        revenueImpact = optimalRevenue - currentRevenue;
      }

      return {
        product,
        forecast,
        pricing,
        competitorPrices: latestCompetitorPrices,
        opportunityScore,
        revenueImpact,
      };
    }).sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [products, forecastData, competitorPrices, salesData]);

  // Get selected product's analysis
  const selectedAnalysis = useMemo(() => {
    if (!selectedProduct) return null;
    return integratedAnalyses.find(a => a.product.id === selectedProduct.id) || null;
  }, [selectedProduct, integratedAnalyses]);

  // Interactive simulation data
  const simulationData = useMemo(() => {
    if (!selectedAnalysis?.pricing) return [];
    const { currentPrice, costPrice, elasticity } = selectedAnalysis.pricing;
    const currentDemand = selectedAnalysis.forecast?.predictedDemand || elasticity.currentDemand || 10;

    const dataPoints = [];
    for (let change = -15; change <= 15; change += 2.5) {
      const price = Math.round(currentPrice * (1 + change / 100));
      const demandChange = elasticity.elasticity * (change / 100);
      const demand = Math.max(0, Math.round(currentDemand * (1 + demandChange)));
      const revenue = price * demand;
      const profit = (price - costPrice) * demand;
      
      dataPoints.push({
        priceChange: change,
        price,
        demand,
        revenue,
        profit,
        label: `${change > 0 ? '+' : ''}${change}%`,
        isSelected: change === simulatedPriceChange[0],
        isOptimal: Math.abs(price - selectedAnalysis.pricing.optimalPrice) < 50,
        isCurrent: change === 0,
      });
    }
    return dataPoints;
  }, [selectedAnalysis, simulatedPriceChange]);

  // Current simulation point
  const currentSimPoint = useMemo(() => {
    return simulationData.find(d => d.priceChange === simulatedPriceChange[0]) || null;
  }, [simulationData, simulatedPriceChange]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-success';
    if (score >= 40) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-success/10';
    if (score >= 40) return 'bg-warning/10';
    return 'bg-muted';
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-heading flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              AI Pricing Intelligence
            </h1>
            <p className="text-muted-foreground mt-1">
              Integrated demand forecasts, competitor intelligence, and optimal pricing
            </p>
          </div>
          {isAdmin && (
            <Button 
              onClick={handleScrapeCompetitorPrices} 
              disabled={isScrapingPrices}
              variant="outline"
              className="gap-2"
            >
              {isScrapingPrices ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4" />
                  Update Competitor Prices
                </>
              )}
            </Button>
          )}
        </div>

        {/* Top Opportunities */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {integratedAnalyses.slice(0, 4).map((analysis, idx) => (
            <Card 
              key={analysis.product.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedProduct?.id === analysis.product.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedProduct(analysis.product)}
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-2">
                  <Badge variant={idx === 0 ? 'default' : 'secondary'} className="text-xs">
                    #{idx + 1} Opportunity
                  </Badge>
                  <div className={`text-lg font-bold ${getScoreColor(analysis.opportunityScore)}`}>
                    {analysis.opportunityScore}
                  </div>
                </div>
                <p className="font-medium text-sm truncate mb-1">{analysis.product.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatCurrency(analysis.product.sellingPrice)}</span>
                  {analysis.pricing && (
                    <>
                      <ArrowRight className="h-3 w-3" />
                      <span className="text-primary font-medium">
                        {formatCurrency(analysis.pricing.optimalPrice)}
                      </span>
                    </>
                  )}
                </div>
                {analysis.revenueImpact !== 0 && (
                  <div className={`mt-2 text-xs flex items-center gap-1 ${
                    analysis.revenueImpact > 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {analysis.revenueImpact > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {formatCurrency(Math.abs(analysis.revenueImpact))} potential
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product List Sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Products
              </CardTitle>
              <CardDescription>Select a product for analysis</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="p-4 space-y-2">
                  {integratedAnalyses.map(analysis => (
                    <button
                      key={analysis.product.id}
                      onClick={() => setSelectedProduct(analysis.product)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedProduct?.id === analysis.product.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate flex-1">{analysis.product.name}</p>
                        <div className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                          selectedProduct?.id === analysis.product.id 
                            ? 'bg-primary-foreground/20 text-primary-foreground' 
                            : getScoreBg(analysis.opportunityScore) + ' ' + getScoreColor(analysis.opportunityScore)
                        }`}>
                          {analysis.opportunityScore}
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 mt-1 text-xs ${
                        selectedProduct?.id === analysis.product.id 
                          ? 'text-primary-foreground/80' 
                          : 'text-muted-foreground'
                      }`}>
                        <span>{formatCurrency(analysis.product.sellingPrice)}</span>
                        {analysis.competitorPrices.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{analysis.competitorPrices.length} competitors</span>
                          </>
                        )}
                        {analysis.forecast && (
                          <>
                            <span>•</span>
                            {analysis.forecast.trend === 'increasing' && <TrendingUp className="h-3 w-3" />}
                            {analysis.forecast.trend === 'decreasing' && <TrendingDown className="h-3 w-3" />}
                            {analysis.forecast.trend === 'stable' && <Minus className="h-3 w-3" />}
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Main Analysis Panel */}
          <div className="lg:col-span-2 space-y-6">
            {selectedAnalysis ? (
              <>
                {/* Product Header */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {selectedAnalysis.product.name}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setShowDetailDialog(true)}
                            className="h-7 px-2"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </CardTitle>
                        <CardDescription>{selectedAnalysis.product.sku} • {selectedAnalysis.product.category}</CardDescription>
                      </div>
                      <div className={`text-center px-4 py-2 rounded-lg ${getScoreBg(selectedAnalysis.opportunityScore)}`}>
                        <p className="text-xs text-muted-foreground">Score</p>
                        <p className={`text-2xl font-bold ${getScoreColor(selectedAnalysis.opportunityScore)}`}>
                          {selectedAnalysis.opportunityScore}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Key Metrics Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Current Price
                        </p>
                        <p className="text-lg font-bold">{formatCurrency(selectedAnalysis.product.sellingPrice)}</p>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Optimal Price
                        </p>
                        <p className="text-lg font-bold text-primary">
                          {selectedAnalysis.pricing ? formatCurrency(selectedAnalysis.pricing.optimalPrice) : 'N/A'}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          Predicted Demand
                        </p>
                        <p className="text-lg font-bold">
                          {selectedAnalysis.forecast?.predictedDemand || 'N/A'} <span className="text-sm font-normal">units</span>
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          Expected Revenue
                        </p>
                        <p className="text-lg font-bold">
                          {selectedAnalysis.pricing ? formatCurrency(selectedAnalysis.pricing.expectedRevenue) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Unified AI Engine Panel */}
                <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="p-2 bg-primary rounded-lg">
                          <Brain className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <span className="text-lg">AI Engine Analysis</span>
                          <p className="text-xs text-muted-foreground font-normal mt-0.5">
                            Integrated forecasting + elasticity + competitor intelligence
                          </p>
                        </div>
                      </CardTitle>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Live Analysis
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* AI Decision Summary */}
                    <div className="p-4 bg-background rounded-lg border">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-heading text-sm mb-1">Strategic Recommendation</h4>
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {selectedAnalysis.pricing?.recommendation || 
                             'Insufficient data. Add sales records or competitor prices to enable AI-powered insights.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Three AI Modules Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Demand Forecasting Module */}
                      <div className="p-3 bg-background rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-success" />
                          </div>
                          <div>
                            <p className="text-xs font-medium">Demand Forecast</p>
                            <p className="text-[10px] text-muted-foreground">Exponential Smoothing</p>
                          </div>
                        </div>
                        {selectedAnalysis.forecast ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Predicted</span>
                              <span className="text-sm font-bold">{selectedAnalysis.forecast.predictedDemand} units</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Trend</span>
                              <div className="flex items-center gap-1">
                                {selectedAnalysis.forecast.trend === 'increasing' && <ArrowUpRight className="h-3 w-3 text-success" />}
                                {selectedAnalysis.forecast.trend === 'decreasing' && <ArrowDownRight className="h-3 w-3 text-destructive" />}
                                {selectedAnalysis.forecast.trend === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
                                <span className="text-xs capitalize">{selectedAnalysis.forecast.trend}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Risk</span>
                              <Badge 
                                variant={selectedAnalysis.forecast.stockoutRisk === 'high' ? 'destructive' : 'secondary'}
                                className="text-[10px] h-5"
                              >
                                {selectedAnalysis.forecast.stockoutRisk}
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No forecast data</p>
                        )}
                      </div>

                      {/* Price Elasticity Module */}
                      <div className="p-3 bg-background rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Activity className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-medium">Price Elasticity</p>
                            <p className="text-[10px] text-muted-foreground">Midpoint Method</p>
                          </div>
                        </div>
                        {selectedAnalysis.pricing ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">PED</span>
                              <span className="text-sm font-bold">{selectedAnalysis.pricing.elasticity.elasticity.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Type</span>
                              <Badge variant="outline" className="text-[10px] h-5">
                                {selectedAnalysis.pricing.elasticity.elasticityType.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Confidence</span>
                              <span className="text-xs">{selectedAnalysis.pricing.elasticity.confidenceLevel}%</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No pricing data</p>
                        )}
                      </div>

                      {/* Competitor Intelligence Module */}
                      <div className="p-3 bg-background rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center">
                            <Globe className="h-4 w-4 text-warning" />
                          </div>
                          <div>
                            <p className="text-xs font-medium">Market Intel</p>
                            <p className="text-[10px] text-muted-foreground">Firecrawl Scraper</p>
                          </div>
                        </div>
                        {selectedAnalysis.competitorPrices.length > 0 ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Sources</span>
                              <span className="text-sm font-bold">{selectedAnalysis.competitorPrices.length}</span>
                            </div>
                            {selectedAnalysis.competitorPrices.slice(0, 2).map(cp => {
                              const diff = ((selectedAnalysis.product.sellingPrice - Number(cp.price)) / Number(cp.price)) * 100;
                              return (
                                <div key={cp.id} className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground truncate max-w-[60px]">{cp.competitor_name}</span>
                                  <Badge 
                                    variant={diff > 5 ? 'destructive' : diff < -5 ? 'default' : 'secondary'}
                                    className="text-[10px] h-5"
                                  >
                                    {diff > 0 ? '+' : ''}{Math.round(diff)}%
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No competitor data</p>
                        )}
                      </div>
                    </div>

                    {/* Optimal Price Result */}
                    {selectedAnalysis.pricing && (
                      <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-2">
                          <Target className="h-5 w-5 text-primary" />
                          <div>
                            <p className="text-xs text-muted-foreground">AI Optimal Price</p>
                            <p className="text-lg font-bold text-primary">{formatCurrency(selectedAnalysis.pricing.optimalPrice)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Expected Revenue</p>
                          <p className="text-lg font-bold">{formatCurrency(selectedAnalysis.pricing.expectedRevenue)}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Interactive Price Simulator */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Interactive Price Simulator
                    </CardTitle>
                    <CardDescription>
                      Adjust price to see real-time impact on demand and revenue
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Slider */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Price Change: {simulatedPriceChange[0] > 0 ? '+' : ''}{simulatedPriceChange[0]}%
                        </span>
                        {currentSimPoint && (
                          <span className="font-semibold text-primary">
                            {formatCurrency(currentSimPoint.price)}
                          </span>
                        )}
                      </div>
                      <Slider
                        value={simulatedPriceChange}
                        onValueChange={setSimulatedPriceChange}
                        min={-15}
                        max={15}
                        step={2.5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>-15%</span>
                        <span>Current</span>
                        <span>+15%</span>
                      </div>
                    </div>

                    {/* Simulation Results */}
                    {currentSimPoint && (
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                        <div className="text-center p-4 bg-primary/5 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">If you charge</p>
                          <p className="text-2xl font-bold text-primary">{formatCurrency(currentSimPoint.price)}</p>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">You'll sell</p>
                          <p className="text-2xl font-bold">{currentSimPoint.demand}</p>
                          <p className="text-xs text-muted-foreground">units/month</p>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                          <p className="text-2xl font-bold">{formatCurrency(currentSimPoint.revenue)}</p>
                        </div>
                      </div>
                    )}

                    {/* Revenue Curve Chart */}
                    <div className="h-[250px] mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={simulationData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="label" 
                            className="text-xs"
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis 
                            yAxisId="left"
                            tickFormatter={(v) => `₱${(v/1000).toFixed(0)}K`} 
                            className="text-xs"
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis 
                            yAxisId="right"
                            orientation="right"
                            className="text-xs"
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              name === 'revenue' ? formatCurrency(value) : value,
                              name === 'revenue' ? 'Revenue' : 'Demand'
                            ]}
                            labelFormatter={(label) => `Price Change: ${label}`}
                            contentStyle={{ fontSize: '12px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Bar 
                            yAxisId="left"
                            dataKey="revenue" 
                            name="Revenue"
                            fill="hsl(var(--primary))"
                            radius={[4, 4, 0, 0]}
                            opacity={0.8}
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="demand"
                            name="Demand"
                            stroke="hsl(var(--success))"
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--success))' }}
                          />
                          <ReferenceLine 
                            x="0%" 
                            yAxisId="left"
                            stroke="hsl(var(--muted-foreground))" 
                            strokeDasharray="3 3"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Competitor Intelligence */}
                {selectedAnalysis.competitorPrices.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Competitor Price Intelligence
                      </CardTitle>
                      <CardDescription>
                        Real-time prices from local competitors via Firecrawl
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedAnalysis.competitorPrices.map(comp => {
                          const diff = ((selectedAnalysis.product.sellingPrice - Number(comp.price)) / Number(comp.price)) * 100;
                          return (
                            <div key={comp.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-sm font-bold text-primary">
                                    {comp.competitor_name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium">{comp.competitor_name}</p>
                                  <p className="text-sm text-muted-foreground">{formatCurrency(Number(comp.price))}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge 
                                  variant={diff > 5 ? 'destructive' : diff < -5 ? 'default' : 'secondary'}
                                  className="font-mono"
                                >
                                  {diff > 0 ? '+' : ''}{Math.round(diff)}%
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {diff > 0 ? 'Higher' : diff < 0 ? 'Lower' : 'Same'} than them
                                </p>
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
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <Brain className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Select a Product</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose from the list to view integrated AI analysis
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              {selectedAnalysis?.product.name} - Complete Analysis
            </DialogTitle>
          </DialogHeader>
          {selectedAnalysis && (
            <div className="space-y-6">
              {/* Full Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Pricing Analysis</h4>
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Current Price</span>
                      <span className="font-medium">{formatCurrency(selectedAnalysis.product.sellingPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Cost Price</span>
                      <span className="font-medium">{formatCurrency(selectedAnalysis.product.costPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Current Margin</span>
                      <span className="font-medium">
                        {Math.round(((selectedAnalysis.product.sellingPrice - selectedAnalysis.product.costPrice) / selectedAnalysis.product.sellingPrice) * 100)}%
                      </span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-primary">
                      <span className="text-sm font-medium">Optimal Price</span>
                      <span className="font-bold">
                        {selectedAnalysis.pricing ? formatCurrency(selectedAnalysis.pricing.optimalPrice) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Inventory Status</h4>
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Current Stock</span>
                      <span className="font-medium">{selectedAnalysis.product.currentStock} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Minimum Stock</span>
                      <span className="font-medium">{selectedAnalysis.product.minStock} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Predicted Demand</span>
                      <span className="font-medium">
                        {selectedAnalysis.forecast?.predictedDemand || 'N/A'} units
                      </span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Reorder Qty</span>
                      <span className="font-bold text-primary">
                        {selectedAnalysis.forecast?.suggestedReorderQty || 'N/A'} units
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Algorithm Explanation */}
              {selectedAnalysis.pricing && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Price Elasticity Calculation</h4>
                  <p className="text-xs text-muted-foreground font-mono">
                    PED = (% Change in Quantity) / (% Change in Price)<br/>
                    Calculated PED: {selectedAnalysis.pricing.elasticity.elasticity.toFixed(2)}<br/>
                    Type: {selectedAnalysis.pricing.elasticity.elasticityType.replace('_', ' ')}<br/>
                    Confidence: {selectedAnalysis.pricing.elasticity.confidenceLevel}%
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
