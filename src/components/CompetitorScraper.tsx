import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Loader2, Globe, CheckCircle, XCircle, AlertCircle, 
  RefreshCw, Download, Building2
} from 'lucide-react';
import { 
  scrapeCompetitorPrices, 
  saveScrapedPrices, 
  ScrapedPrice,
  Competitor,
  ALL_COMPETITORS,
} from '@/lib/api/competitorScraper';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  sellingPrice: number;
}

interface CompetitorScraperProps {
  products: Product[];
  onComplete?: () => void;
  userId?: string;
}

export function CompetitorScraper({ products, onComplete, userId }: CompetitorScraperProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<Competitor[]>([...ALL_COMPETITORS]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ScrapedPrice[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleCompetitor = (competitor: Competitor) => {
    setSelectedCompetitors(prev =>
      prev.includes(competitor)
        ? prev.filter(c => c !== competitor)
        : [...prev, competitor]
    );
  };

  const selectAllProducts = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
  };

  const handleScrape = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    if (selectedCompetitors.length === 0) {
      toast.error('Please select at least one competitor');
      return;
    }

    setIsScanning(true);
    setProgress(0);
    setResults([]);

    try {
      // No need for manual search terms - the edge function generates them automatically!
      const productsToScrape = products
        .filter(p => selectedProducts.includes(p.id))
        .map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,  // Category is used to auto-generate search terms
        }));

      // Simulate progress while waiting
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 2, 90));
      }, 500);

      const result = await scrapeCompetitorPrices(productsToScrape, selectedCompetitors);

      clearInterval(progressInterval);
      setProgress(100);

      if (result.success && result.data) {
        setResults(result.data);
        const found = result.data.filter(r => r.price !== null).length;
        toast.success(`Found ${found} prices from ${result.summary?.competitors || 0} competitors`);
      } else {
        toast.error(result.error || 'Failed to scrape prices');
      }
    } catch (error) {
      console.error('Scrape error:', error);
      toast.error('Failed to scrape competitor prices');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveResults = async () => {
    const validResults = results.filter(r => r.price !== null);
    if (validResults.length === 0) {
      toast.error('No valid prices to save');
      return;
    }

    setIsSaving(true);
    try {
      const { saved, errors } = await saveScrapedPrices(validResults, userId);
      toast.success(`Saved ${saved} prices to database${errors > 0 ? ` (${errors} failed)` : ''}`);
      onComplete?.();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save prices');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);

  const foundCount = results.filter(r => r.price !== null).length;
  const notFoundCount = results.filter(r => r.price === null).length;

  return (
    <div className="space-y-6">
      {/* Competitor Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Select Competitors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ALL_COMPETITORS.map(competitor => (
              <label
                key={competitor}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedCompetitors.includes(competitor)
                    ? 'bg-primary/10 border-primary'
                    : 'bg-muted/50 border-transparent hover:bg-muted'
                }`}
              >
                <Checkbox
                  checked={selectedCompetitors.includes(competitor)}
                  onCheckedChange={() => toggleCompetitor(competitor)}
                />
                <span className="font-medium">{competitor}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Product Selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Select Products to Scrape</CardTitle>
            <Button variant="outline" size="sm" onClick={selectAllProducts}>
              {selectedProducts.length === products.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <CardDescription>
            {selectedProducts.length} of {products.length} products selected
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {products.map(product => (
                <label
                  key={product.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedProducts.includes(product.id)
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  <Checkbox
                    checked={selectedProducts.includes(product.id)}
                    onCheckedChange={() => toggleProduct(product.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">
                    {formatCurrency(product.sellingPrice)}
                  </span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="flex justify-center">
        <Button 
          size="lg" 
          onClick={handleScrape}
          disabled={isScanning || selectedProducts.length === 0 || selectedCompetitors.length === 0}
          className="gap-2 px-8"
        >
          {isScanning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Scanning Competitors...
            </>
          ) : (
            <>
              <Globe className="h-5 w-5" />
              Scan {selectedCompetitors.length} Competitors for {selectedProducts.length} Products
            </>
          )}
        </Button>
      </div>

      {/* Progress */}
      {isScanning && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Scraping competitor websites...</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                This may take a few minutes depending on the number of products
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Scrape Results</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {foundCount} Found
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {notFoundCount} Not Found
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {/* Group by product */}
                {[...new Set(results.map(r => r.productId))].map(productId => {
                  const productResults = results.filter(r => r.productId === productId);
                  const productName = productResults[0]?.productName || 'Unknown';
                  
                  return (
                    <div key={productId} className="p-4 bg-muted/50 rounded-lg space-y-3">
                      <p className="font-medium">{productName}</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {productResults.map((result, idx) => (
                          <div 
                            key={idx}
                            className={`flex items-center justify-between p-2 rounded ${
                              result.price !== null ? 'bg-primary/10' : 'bg-muted'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {result.price !== null ? (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">{result.competitor}</span>
                            </div>
                            <span className={`text-sm font-mono ${result.price !== null ? 'text-primary' : 'text-muted-foreground'}`}>
                              {result.price !== null ? formatCurrency(result.price) : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {foundCount > 0 && (
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                <Button variant="outline" onClick={() => setResults([])} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Clear Results
                </Button>
                <Button onClick={handleSaveResults} disabled={isSaving} className="gap-2">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Save {foundCount} Prices to Database
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
