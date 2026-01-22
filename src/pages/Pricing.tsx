import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { PricingSimulator } from '@/components/PricingSimulator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { analyzePricing, PricingAnalysis } from '@/lib/pricingElasticity';
import { 
  Calculator, TrendingUp, DollarSign, Target, Search, 
  Plus, Loader2, Building2, AlertCircle, ChevronRight
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  sellingPrice: number;
  costPrice: number;
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

export default function Pricing() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [products, setProducts] = useState<Product[]>([]);
  const [competitorPrices, setCompetitorPrices] = useState<CompetitorPrice[]>([]);
  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add competitor price dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addingPrice, setAddingPrice] = useState(false);
  const [newCompetitorPrice, setNewCompetitorPrice] = useState({
    productId: '',
    competitor: 'Octagon' as 'Octagon' | 'Villman' | 'PC Express',
    price: 0,
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, category, selling_price, cost_price')
        .order('name');

      if (productsError) throw productsError;

      const mappedProducts: Product[] = (productsData || []).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        sellingPrice: Number(p.selling_price),
        costPrice: Number(p.cost_price),
      }));
      setProducts(mappedProducts);

      // Fetch competitor prices
      const { data: competitorData, error: competitorError } = await supabase
        .from('competitor_prices')
        .select('*')
        .order('recorded_at', { ascending: false });

      if (competitorError) throw competitorError;
      setCompetitorPrices(competitorData || []);

      // Fetch sales data
      const { data: salesRecords, error: salesError } = await supabase
        .from('sales')
        .select('product_id, quantity, unit_price, sale_date')
        .order('sale_date', { ascending: false })
        .limit(500);

      if (salesError) throw salesError;
      setSalesData(salesRecords || []);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompetitorPrice = async () => {
    if (!newCompetitorPrice.productId || newCompetitorPrice.price <= 0) {
      toast.error('Please select a product and enter a valid price');
      return;
    }

    setAddingPrice(true);
    try {
      const product = products.find(p => p.id === newCompetitorPrice.productId);
      
      const { error } = await supabase
        .from('competitor_prices')
        .insert({
          product_id: newCompetitorPrice.productId,
          product_name: product?.name || '',
          competitor_name: newCompetitorPrice.competitor,
          price: newCompetitorPrice.price,
        });

      if (error) throw error;

      toast.success('Competitor price added');
      setIsAddDialogOpen(false);
      setNewCompetitorPrice({ productId: '', competitor: 'Octagon', price: 0 });
      fetchData();
    } catch (error: any) {
      console.error('Error adding competitor price:', error);
      toast.error('Failed to add competitor price');
    } finally {
      setAddingPrice(false);
    }
  };

  // Calculate pricing analysis for selected product
  const pricingAnalysis = useMemo((): PricingAnalysis | null => {
    if (!selectedProduct) return null;

    const productSales = salesData
      .filter(s => s.product_id === selectedProduct.id)
      .map(s => ({
        productId: s.product_id,
        quantity: s.quantity,
        unitPrice: Number(s.unit_price),
        saleDate: s.sale_date,
      }));

    const productCompetitors = competitorPrices
      .filter(c => c.product_id === selectedProduct.id)
      .reduce((acc, curr) => {
        // Get latest price per competitor
        const existing = acc.find(a => a.competitorName === curr.competitor_name);
        if (!existing) {
          acc.push({ competitorName: curr.competitor_name, price: Number(curr.price) });
        }
        return acc;
      }, [] as { competitorName: string; price: number }[]);

    return analyzePricing(
      selectedProduct.id,
      selectedProduct.name,
      selectedProduct.sellingPrice,
      selectedProduct.costPrice,
      productSales,
      productCompetitors
    );
  }, [selectedProduct, salesData, competitorPrices]);

  // Filter products
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get products with pricing opportunities
  const pricingOpportunities = useMemo(() => {
    return products.slice(0, 5).map(product => {
      const productCompetitors = competitorPrices
        .filter(c => c.product_id === product.id)
        .reduce((acc, curr) => {
          const existing = acc.find(a => a.competitorName === curr.competitor_name);
          if (!existing) {
            acc.push({ competitorName: curr.competitor_name, price: Number(curr.price) });
          }
          return acc;
        }, [] as { competitorName: string; price: number }[]);

      const avgCompetitorPrice = productCompetitors.length > 0
        ? productCompetitors.reduce((sum, c) => sum + c.price, 0) / productCompetitors.length
        : product.sellingPrice;

      const priceDiff = ((product.sellingPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100;

      return {
        ...product,
        competitorCount: productCompetitors.length,
        avgCompetitorPrice,
        priceDiff,
      };
    }).filter(p => p.competitorCount > 0);
  }, [products, competitorPrices]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-heading flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              Pricing Simulator
            </h1>
            <p className="text-muted-foreground mt-1">
              Analyze price elasticity and simulate demand at different price points
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
              <Plus size={18} />
              Add Competitor Price
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Product Selection Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Select Product</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedProduct?.id === product.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className={`text-xs ${selectedProduct?.id === product.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {formatCurrency(product.sellingPrice)}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Opportunities */}
            {pricingOpportunities.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Pricing Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pricingOpportunities.map(opp => (
                    <button
                      key={opp.id}
                      onClick={() => setSelectedProduct(opp)}
                      className="w-full text-left p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <p className="text-sm font-medium truncate">{opp.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{opp.competitorCount} competitors</span>
                        <Badge 
                          variant={opp.priceDiff > 5 ? "destructive" : opp.priceDiff < -5 ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {opp.priceDiff > 0 ? '+' : ''}{Math.round(opp.priceDiff)}%
                        </Badge>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedProduct && pricingAnalysis ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedProduct.name}</CardTitle>
                        <CardDescription>{selectedProduct.sku} • {selectedProduct.category}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                
                <PricingSimulator analysis={pricingAnalysis} />
              </div>
            ) : (
              <Card className="h-[400px] flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <Calculator className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Select a Product</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose a product from the list to view pricing analysis and simulations
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Add Competitor Price Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Add Competitor Price
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label>Product</Label>
                <Select 
                  value={newCompetitorPrice.productId} 
                  onValueChange={(v) => setNewCompetitorPrice(prev => ({ ...prev, productId: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Competitor</Label>
                <Select 
                  value={newCompetitorPrice.competitor} 
                  onValueChange={(v: 'Octagon' | 'Villman' | 'PC Express') => setNewCompetitorPrice(prev => ({ ...prev, competitor: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Octagon">Octagon</SelectItem>
                    <SelectItem value="Villman">Villman</SelectItem>
                    <SelectItem value="PC Express">PC Express</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Price (₱)</Label>
                <Input
                  type="number"
                  value={newCompetitorPrice.price || ''}
                  onChange={(e) => setNewCompetitorPrice(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCompetitorPrice} disabled={addingPrice}>
                {addingPrice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Price
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
