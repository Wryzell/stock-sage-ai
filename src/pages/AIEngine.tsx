import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateForecasts, ForecastResult } from '@/lib/forecasting';
import { scrapeCompetitorPrices, saveScrapedPrices, getProductsNeedingScrape, ScanMode } from '@/lib/api/competitorScraper';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import {
  Brain, TrendingUp, TrendingDown, Loader2, Minus, RefreshCw,
  Package, Zap, ArrowDown, ArrowUp, Info, Search, Download,
  Wifi, WifiOff, AlertCircle, CheckCircle, Filter
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer
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

interface CompetitorData {
  competitorName: string;
  price: number;
  isReal: boolean;
}

interface ProductAnalysis {
  product: Product;
  forecast: ForecastResult;
  competitors: CompetitorData[];
  avgCompetitorPrice: number;
  priceDifference: number;
  priceAction: 'lower' | 'raise' | 'hold';
  priceRecommendation: string;
  whenToBuy: string;
  buyUrgency: 'urgent' | 'soon' | 'plan' | 'wait';
  adjustedDemand: number;
  hasSalesHistory: boolean;
  hasRealPrices: boolean;
}

type FilterType = 'all' | 'needs_action' | 'has_sales';

export default function AIEngine() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [realCompetitorPrices, setRealCompetitorPrices] = useState<any[]>([]);
  const [productAnalyses, setProductAnalyses] = useState<ProductAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState({ current: 0, total: 0, message: '' });
  const [hasGenerated, setHasGenerated] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

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
        sku: p.sku,
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

  const handleScrapeCompetitorPrices = async (mode: ScanMode = 'quick') => {
    try {
      setScraping(true);
      setScrapeProgress({ current: 0, total: 0, message: 'Checking for recent prices...' });
      
      // Get products based on scan mode
      let productsToScrape = products.slice(0, mode === 'quick' ? 10 : 20).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        sellingPrice: p.sellingPrice
      }));
      
      // For full scan, skip products with recent prices (last 24 hours)
      if (mode === 'full') {
        setScrapeProgress({ current: 0, total: 0, message: 'Checking cached prices...' });
        const needsScrape = await getProductsNeedingScrape(productsToScrape, 24);
        
        if (needsScrape.length < productsToScrape.length) {
          const skipped = productsToScrape.length - needsScrape.length;
          toast.info(`Skipping ${skipped} products with recent prices`);
          // Re-filter to match original structure
          const needsScrapeIds = new Set(needsScrape.map(p => p.id));
          productsToScrape = productsToScrape.filter(p => needsScrapeIds.has(p.id));
        }
      }
      
      if (productsToScrape.length === 0) {
        toast.success('All products have recent competitor prices');
        setScraping(false);
        setScrapeProgress({ current: 0, total: 0, message: '' });
        return;
      }
      
      const totalRequests = productsToScrape.length * 3; // 3 competitors
      setScrapeProgress({ 
        current: 0, 
        total: productsToScrape.length, 
        message: `Scanning ${productsToScrape.length} products across 3 competitors...` 
      });
      
      const result = await scrapeCompetitorPrices(productsToScrape, undefined, mode);
      
      if (result.success && result.data && result.data.length > 0) {
        setScrapeProgress({ current: productsToScrape.length, total: productsToScrape.length, message: 'Saving prices to database...' });
        const validPrices = result.data.filter(p => p.price && p.price > 0);
        
        if (validPrices.length > 0) {
          await saveScrapedPrices(validPrices, user?.id);
        }
        
        // Refresh competitor prices
        const competitorRes = await supabase.from('competitor_prices').select('*').order('recorded_at', { ascending: false });
        setRealCompetitorPrices(competitorRes.data || []);
        
        toast.success(`Found ${result.summary?.successful || 0} prices from ${result.summary?.products || 0} products`);
      } else {
        toast.info('No new prices found. Try again later.');
      }
    } catch (error: any) {
      toast.error('Failed to scan competitor prices');
    } finally {
      setScraping(false);
      setScrapeProgress({ current: 0, total: 0, message: '' });
    }
  };

  const generateMockCompetitors = (product: Product): CompetitorData[] => {
    const competitors = ['Octagon', 'Villman', 'PC Express'];
    const basePrice = product.sellingPrice;
    
    return competitors.map(name => {
      const variance = (Math.random() * 0.35 - 0.15);
      const competitorPrice = Math.round(basePrice * (1 + variance));
      return {
        competitorName: name,
        price: Math.max(competitorPrice, product.costPrice * 1.05),
        isReal: false,
      };
    });
  };

  const analyzeProduct = (
    product: Product, 
    forecast: ForecastResult,
    competitors: CompetitorData[],
    hasSalesHistory: boolean
  ): ProductAnalysis => {
    const avgCompetitorPrice = competitors.reduce((sum, c) => sum + c.price, 0) / competitors.length;
    const priceDifference = ((product.sellingPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100;
    const hasRealPrices = competitors.some(c => c.isReal);
    
    // Adjust demand based on price position (price intelligence)
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
    
    const monthlyDemand = adjustedDemand;
    const weeksOfStock = (product.currentStock / Math.max(1, monthlyDemand / 4));
    
    let whenToBuy = '';
    let buyUrgency: 'urgent' | 'soon' | 'plan' | 'wait' = 'wait';
    
    // Format stock duration for display - convert to days when less than 1 week
    const formatStockDuration = (weeks: number): string => {
      const days = Math.round(weeks * 7);
      if (days <= 3) return `${days} days`;
      if (days < 7) return `${days} days`;
      if (weeks < 2) return '1 week';
      if (weeks >= 12) return '3+ months';
      if (weeks >= 4) return `${Math.round(weeks)} weeks`;
      return `${Math.round(weeks)} weeks`;
    };
    
    if (weeksOfStock < 1 && monthlyDemand > 5) {
      buyUrgency = 'urgent';
      whenToBuy = `⚠️ Running low! Only ${formatStockDuration(weeksOfStock)} left. Order ${forecast.suggestedReorderQty} units now.`;
    } else if (weeksOfStock < 2 && monthlyDemand > 3) {
      buyUrgency = 'soon';
      whenToBuy = `Order within the week. ${formatStockDuration(weeksOfStock)} of stock left. Need ${forecast.suggestedReorderQty} units.`;
    } else if (weeksOfStock < 4) {
      buyUrgency = 'plan';
      whenToBuy = `Schedule order. ${formatStockDuration(weeksOfStock)} of stock remaining.`;
    } else {
      buyUrgency = 'wait';
      whenToBuy = `No rush. ${formatStockDuration(weeksOfStock)} of stock on hand.`;
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
      hasSalesHistory,
      hasRealPrices,
    };
  };

  const generateAlertsFromForecasts = async (analyses: ProductAnalysis[]) => {
    try {
      // Get existing unresolved alerts
      const { data: existingAlerts } = await supabase
        .from('alerts')
        .select('product_id, type')
        .eq('is_resolved', false);
      
      const existingAlertKeys = new Set(
        (existingAlerts || []).map(a => `${a.product_id}-${a.type}`)
      );
      
      const newAlerts: any[] = [];
      
      for (const analysis of analyses) {
        if (!analysis.hasSalesHistory) continue;
        
        // Low stock alerts
        if (analysis.buyUrgency === 'urgent') {
          const key = `${analysis.product.id}-low_stock`;
          if (!existingAlertKeys.has(key)) {
            newAlerts.push({
              product_id: analysis.product.id,
              product_name: analysis.product.name,
              type: 'low_stock',
              severity: 'critical',
              message: `Critical: Only ${analysis.product.currentStock} units left. Predicted demand: ${analysis.adjustedDemand}/month. Order ${analysis.forecast.suggestedReorderQty} units now.`,
            });
          }
        } else if (analysis.buyUrgency === 'soon') {
          const key = `${analysis.product.id}-stockout_risk`;
          if (!existingAlertKeys.has(key)) {
            newAlerts.push({
              product_id: analysis.product.id,
              product_name: analysis.product.name,
              type: 'stockout_risk',
              severity: 'warning',
              message: `Stock running low. ${analysis.product.currentStock} units remaining. Consider ordering soon.`,
            });
          }
        }
        
        // Pricing opportunity alerts
        if (Math.abs(analysis.priceDifference) > 15) {
          const key = `${analysis.product.id}-demand_surge`;
          if (!existingAlertKeys.has(key)) {
            newAlerts.push({
              product_id: analysis.product.id,
              product_name: analysis.product.name,
              type: 'demand_surge',
              severity: 'info',
              message: analysis.priceDifference > 0 
                ? `Price ${analysis.priceDifference.toFixed(0)}% above market. Consider lowering for better sales.`
                : `Price ${Math.abs(analysis.priceDifference).toFixed(0)}% below market. Opportunity to increase margin.`,
            });
          }
        }
      }
      
      if (newAlerts.length > 0) {
        await supabase.from('alerts').insert(newAlerts);
        toast.success(`Generated ${newAlerts.length} new alerts`);
      }
    } catch (error) {
      console.error('Failed to generate alerts:', error);
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
      
      const productsWithSales = new Set(salesData.map((s: any) => s.product_id));
      
      const analyses: ProductAnalysis[] = [];
      products.forEach(product => {
        const forecast = forecasts.forecasts.find(f => f.productName === product.name);
        if (forecast) {
          const realData = realCompetitorPrices.filter(c => c.product_id === product.id);
          let competitors: CompetitorData[];
          
          if (realData.length > 0) {
            competitors = realData.map(c => ({
              competitorName: c.competitor_name,
              price: Number(c.price),
              isReal: true,
            }));
          } else {
            competitors = generateMockCompetitors(product);
          }
          
          const hasSalesHistory = productsWithSales.has(product.id);
          analyses.push(analyzeProduct(product, forecast, competitors, hasSalesHistory));
        }
      });
      
      // Sort by: products with sales first, then by urgency
      const sortedAnalyses = analyses.sort((a, b) => {
        if (a.hasSalesHistory !== b.hasSalesHistory) {
          return a.hasSalesHistory ? -1 : 1;
        }
        const urgencyOrder = { urgent: 0, soon: 1, plan: 2, wait: 3 };
        return urgencyOrder[a.buyUrgency] - urgencyOrder[b.buyUrgency];
      });
      
      setProductAnalyses(sortedAnalyses);
      
      // Auto-generate alerts
      await generateAlertsFromForecasts(sortedAnalyses);
      
      setHasGenerated(true);
      toast.success('Forecast generated');

    } catch (error: any) {
      toast.error('Failed to generate forecast');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportReport = () => {
    const data = filteredAnalyses.map(a => ({
      'Product': a.product.name,
      'SKU': a.product.sku,
      'Category': a.product.category,
      'Current Stock': a.product.currentStock,
      'Min Stock': a.product.minStock,
      'Predicted Demand/Month': a.adjustedDemand,
      'Trend': a.forecast.trend,
      'Confidence %': a.forecast.confidenceLevel,
      'Status': a.buyUrgency === 'urgent' ? 'Order Now' : a.buyUrgency === 'soon' ? 'Order Soon' : a.buyUrgency === 'plan' ? 'Plan' : 'OK',
      'Reorder Qty': a.forecast.suggestedReorderQty,
      'Your Price': a.product.sellingPrice,
      'Market Avg': Math.round(a.avgCompetitorPrice),
      'Price Difference %': a.priceDifference.toFixed(1),
      'Price Action': a.priceAction,
      'Has Sales History': a.hasSalesHistory ? 'Yes' : 'No',
      'Has Real Prices': a.hasRealPrices ? 'Yes' : 'No',
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Forecasts');
    
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `forecast-report-${date}.xlsx`);
    toast.success('Report exported');
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

    const result: { date: string; historical: number | null; predicted: number | null }[] = [];
    
    sortedWeeks.forEach(([date, qty]) => {
      result.push({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        historical: qty,
        predicted: null,
      });
    });

    const lastDate = sortedWeeks.length > 0 
      ? new Date(sortedWeeks[sortedWeeks.length - 1][0]) 
      : new Date();
    const weeklyDemand = Math.max(1, Math.round(selectedAnalysis.adjustedDemand / 4));
    
    for (let i = 1; i <= 4; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + (i * 7));
      result.push({
        date: forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        historical: null,
        predicted: weeklyDemand + Math.round((Math.random() - 0.5) * Math.max(1, weeklyDemand * 0.2)),
      });
    }

    return result;
  }, [selectedAnalysis, salesData]);

  // Filtered and searched analyses
  const filteredAnalyses = useMemo(() => {
    let result = productAnalyses;
    
    // Apply filter
    if (filter === 'needs_action') {
      result = result.filter(a => a.buyUrgency === 'urgent' || a.buyUrgency === 'soon' || Math.abs(a.priceDifference) > 10);
    } else if (filter === 'has_sales') {
      result = result.filter(a => a.hasSalesHistory);
    }
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a => 
        a.product.name.toLowerCase().includes(query) ||
        a.product.category.toLowerCase().includes(query) ||
        a.product.sku.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [productAnalyses, filter, searchQuery]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const withSales = productAnalyses.filter(a => a.hasSalesHistory);
    return {
      total: productAnalyses.length,
      withSales: withSales.length,
      needsReorder: productAnalyses.filter(a => a.buyUrgency === 'urgent' || a.buyUrgency === 'soon').length,
      pricingOpportunities: productAnalyses.filter(a => Math.abs(a.priceDifference) > 10).length,
      healthy: productAnalyses.filter(a => a.buyUrgency === 'wait' && Math.abs(a.priceDifference) <= 10).length,
      realPricesCount: realCompetitorPrices.length,
    };
  }, [productAnalyses, realCompetitorPrices]);

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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Demand Forecasting
            </h1>
            <p className="text-sm text-muted-foreground">
              Predictions adjusted with competitor price intelligence
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Scan Buttons */}
            <div className="flex gap-1 border border-border rounded-md overflow-hidden">
              <Button 
                onClick={() => handleScrapeCompetitorPrices('quick')} 
                variant="ghost" 
                size="sm"
                disabled={scraping}
                className="rounded-none border-r border-border"
              >
                {scraping ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 mr-2" />
                    Quick Scan
                  </>
                )}
              </Button>
              <Button 
                onClick={() => handleScrapeCompetitorPrices('full')} 
                variant="ghost" 
                size="sm"
                disabled={scraping}
                className="rounded-none"
              >
                Full Scan
              </Button>
            </div>
            
            {hasGenerated && (
              <>
                <Button onClick={handleExportReport} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button onClick={() => setShowExplanation(true)} variant="ghost" size="sm">
                  <Info className="h-4 w-4 mr-1" />
                  How it works
                </Button>
                <Button onClick={() => { setHasGenerated(false); fetchData(); }} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Scraping Progress */}
        {scraping && scrapeProgress.message && (
          <div className="space-y-2 bg-muted/50 p-4 rounded-lg border border-border">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{scrapeProgress.message}</span>
            </div>
            {scrapeProgress.total > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{scrapeProgress.current} / {scrapeProgress.total} products</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(scrapeProgress.current / scrapeProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Estimated time: ~{Math.ceil((scrapeProgress.total - scrapeProgress.current) * 0.5)} min remaining
                </p>
              </div>
            )}
          </div>
        )}

        {/* Market Data Status */}
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            {summaryStats.realPricesCount > 0 ? (
              <>
                <Wifi className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">{summaryStats.realPricesCount} real competitor prices</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">No market data - using estimates</span>
              </>
            )}
          </span>
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

        {/* Results */}
        {hasGenerated && productAnalyses.length > 0 && (
          <div className="space-y-4">
            {/* Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-destructive">{summaryStats.needsReorder}</div>
                <div className="text-xs text-muted-foreground">Need Reorder</div>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">{summaryStats.pricingOpportunities}</div>
                <div className="text-xs text-muted-foreground">Pricing Opportunities</div>
              </div>
              <div className="bg-muted border border-border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{summaryStats.healthy}</div>
                <div className="text-xs text-muted-foreground">Healthy</div>
              </div>
              <div className="bg-muted border border-border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{summaryStats.withSales}</div>
                <div className="text-xs text-muted-foreground">With Sales Data</div>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={filter === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button 
                  variant={filter === 'needs_action' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilter('needs_action')}
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Needs Action
                </Button>
                <Button 
                  variant={filter === 'has_sales' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilter('has_sales')}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Has Sales
                </Button>
              </div>
            </div>

            {/* Results count */}
            <p className="text-sm text-muted-foreground">
              Showing {filteredAnalyses.length} of {productAnalyses.length} products
            </p>
            
            {/* Product Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Product</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-right p-3 font-medium">Stock</th>
                    <th className="text-right p-3 font-medium">Demand/mo</th>
                    <th className="text-center p-3 font-medium">Trend</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-center p-3 font-medium">Price</th>
                    <th className="text-center p-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAnalyses.map(analysis => (
                    <tr 
                      key={analysis.product.id}
                      className={`hover:bg-muted/30 cursor-pointer transition-colors ${!analysis.hasSalesHistory ? 'opacity-60' : ''}`}
                      onClick={() => handleProductClick(analysis.product.id)}
                    >
                      <td className="p-3">
                        <span className="font-medium">{analysis.product.name}</span>
                        {!analysis.hasSalesHistory && (
                          <span className="text-xs text-muted-foreground ml-2">(no sales)</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{analysis.product.category}</td>
                      <td className="p-3 text-right">{analysis.product.currentStock}</td>
                      <td className="p-3 text-right font-medium text-primary">{analysis.adjustedDemand}</td>
                      <td className="p-3 text-center">
                        {analysis.forecast.trend === 'increasing' && <TrendingUp className="h-4 w-4 text-primary inline" />}
                        {analysis.forecast.trend === 'decreasing' && <TrendingDown className="h-4 w-4 text-destructive inline" />}
                        {analysis.forecast.trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground inline" />}
                      </td>
                      <td className="p-3 text-center">
                        {analysis.hasSalesHistory ? (
                          <Badge variant={
                            analysis.buyUrgency === 'urgent' ? 'destructive' :
                            analysis.buyUrgency === 'soon' ? 'default' :
                            'secondary'
                          } className="text-xs">
                            {analysis.buyUrgency === 'urgent' ? 'Order Now' :
                             analysis.buyUrgency === 'soon' ? 'Order Soon' :
                             analysis.buyUrgency === 'plan' ? 'Plan' : 'OK'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
                      <td className="p-3 text-center">
                        <span title={analysis.hasRealPrices ? "Real competitor data" : "Estimated prices"}>
                          {analysis.hasRealPrices ? (
                            <Wifi className="h-3 w-3 text-primary inline" />
                          ) : (
                            <WifiOff className="h-3 w-3 text-muted-foreground inline" />
                          )}
                        </span>
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
                    {!selectedAnalysis.hasSalesHistory && (
                      <Badge variant="outline" className="text-xs ml-2">No sales history</Badge>
                    )}
                    {selectedAnalysis.hasRealPrices ? (
                      <Badge variant="secondary" className="text-xs ml-2 flex items-center gap-1">
                        <Wifi className="h-3 w-3" /> Real Prices
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs ml-2 flex items-center gap-1">
                        <WifiOff className="h-3 w-3" /> Estimated
                      </Badge>
                    )}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-muted/30 rounded">
                      <p className="text-2xl font-bold text-primary">{selectedAnalysis.adjustedDemand}</p>
                      <p className="text-xs text-muted-foreground">Predicted/mo</p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded">
                      <p className="text-2xl font-bold">{selectedAnalysis.product.currentStock}</p>
                      <p className="text-xs text-muted-foreground">In Stock</p>
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

                  {/* Forecast Chart */}
                  <div className="p-3 rounded border border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">DEMAND FORECAST</p>
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
                    {!selectedAnalysis.hasSalesHistory && (
                      <p className="text-xs text-muted-foreground mt-2">
                        No historical sales. Prediction based on category averages.
                      </p>
                    )}
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
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {selectedAnalysis.competitors.map((c, i) => (
                        <span key={i} className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1">
                          {c.isReal ? <Wifi className="h-3 w-3 text-primary" /> : <WifiOff className="h-3 w-3 text-muted-foreground" />}
                          {c.competitorName}: {formatMoney(c.price)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* AI Note */}
                  <p className="text-xs text-muted-foreground">
                    {selectedAnalysis.forecast.recommendation}
                  </p>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Explanation Dialog */}
        <Dialog open={showExplanation} onOpenChange={setShowExplanation}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>How Price Intelligence Improves Accuracy</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-1">The Problem</h4>
                <p className="text-muted-foreground">
                  Traditional demand forecasting only looks at your sales history. But sales depend heavily on your price relative to competitors.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Our Solution</h4>
                <p className="text-muted-foreground">
                  We compare your prices against Octagon, Villman, and PC Express, then adjust predictions using price elasticity:
                </p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>• <strong>Higher than market:</strong> Demand reduced (customers buy elsewhere)</li>
                  <li>• <strong>Lower than market:</strong> Demand increased (you attract more buyers)</li>
                  <li>• <strong>Competitive:</strong> Base prediction holds</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Real vs Estimated Prices</h4>
                <p className="text-muted-foreground">
                  <Wifi className="h-3 w-3 text-primary inline mr-1" /> = Real scraped data from competitor websites<br/>
                  <WifiOff className="h-3 w-3 text-muted-foreground inline mr-1" /> = Estimated based on typical market variance
                </p>
                <p className="text-muted-foreground mt-2">
                  Click "Refresh Market Prices" to fetch real competitor data for more accurate predictions.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">The Result</h4>
                <p className="text-muted-foreground">
                  More accurate reorder quantities and clear guidance on whether to adjust pricing for optimal inventory turnover.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
