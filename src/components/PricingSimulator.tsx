import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, BarChart, Bar, ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Target, 
  AlertTriangle, CheckCircle, ArrowRight, Info
} from 'lucide-react';
import { PricingAnalysis, PriceSimulation } from '@/lib/pricingElasticity';

interface PricingSimulatorProps {
  analysis: PricingAnalysis;
  onUpdateCompetitorPrice?: (competitor: string, price: number) => void;
}

export function PricingSimulator({ analysis, onUpdateCompetitorPrice }: PricingSimulatorProps) {
  const [simulatedPriceChange, setSimulatedPriceChange] = useState([0]);
  
  const currentSimulation = useMemo(() => {
    const change = simulatedPriceChange[0];
    const simulation = analysis.simulations.find(s => s.priceChange === change);
    if (simulation) return simulation;
    
    // Interpolate if exact match not found
    const price = Math.round(analysis.currentPrice * (1 + change / 100));
    const elasticity = analysis.elasticity.elasticity;
    const demandChange = elasticity * (change / 100);
    const demand = Math.max(0, Math.round(analysis.elasticity.currentDemand * (1 + demandChange)));
    const revenue = price * demand;
    const profit = (price - analysis.costPrice) * demand;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    
    return {
      priceChange: change,
      simulatedPrice: price,
      simulatedDemand: demand,
      simulatedRevenue: revenue,
      profitMargin: Math.round(profitMargin * 10) / 10,
    };
  }, [simulatedPriceChange, analysis]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);

  const getElasticityBadge = () => {
    const type = analysis.elasticity.elasticityType;
    if (type === 'elastic') {
      return <Badge variant="destructive">Elastic (Price Sensitive)</Badge>;
    } else if (type === 'inelastic') {
      return <Badge variant="default">Inelastic (Price Stable)</Badge>;
    }
    return <Badge variant="secondary">Unit Elastic</Badge>;
  };

  const revenueChartData = analysis.simulations.map(sim => ({
    priceChange: `${sim.priceChange > 0 ? '+' : ''}${sim.priceChange}%`,
    price: sim.simulatedPrice,
    demand: sim.simulatedDemand,
    revenue: sim.simulatedRevenue,
    isOptimal: sim.simulatedPrice === analysis.optimalPrice,
    isCurrent: sim.priceChange === 0,
  }));

  const demandCurveData = analysis.simulations.map(sim => ({
    price: sim.simulatedPrice,
    demand: sim.simulatedDemand,
    label: `${sim.priceChange > 0 ? '+' : ''}${sim.priceChange}%`,
  }));

  return (
    <div className="space-y-6">
      {/* Header with Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              Current Price
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(analysis.currentPrice)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cost: {formatCurrency(analysis.costPrice)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="h-4 w-4" />
              Optimal Price
            </div>
            <p className="text-2xl font-bold mt-1 text-primary">{formatCurrency(analysis.optimalPrice)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {analysis.optimalPrice > analysis.currentPrice ? '+' : ''}
              {Math.round(((analysis.optimalPrice - analysis.currentPrice) / analysis.currentPrice) * 100)}% from current
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4" />
              Expected Demand
            </div>
            <p className="text-2xl font-bold mt-1">{analysis.expectedDemand} units</p>
            <p className="text-xs text-muted-foreground mt-1">
              At optimal price (30-day)
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              Expected Revenue
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(analysis.expectedRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              At optimal price (30-day)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Elasticity Info */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Price Elasticity Analysis</CardTitle>
            {getElasticityBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm">{analysis.recommendation}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Elasticity coefficient: {analysis.elasticity.elasticity.toFixed(2)} | 
                Confidence: {analysis.elasticity.confidenceLevel}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Price Simulator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Interactive Price Simulator</CardTitle>
          <CardDescription>
            Adjust the slider to see predicted demand and revenue at different price points
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Price Change: {simulatedPriceChange[0] > 0 ? '+' : ''}{simulatedPriceChange[0]}%</span>
              <span className="font-semibold">{formatCurrency(currentSimulation.simulatedPrice)}</span>
            </div>
            <Slider
              value={simulatedPriceChange}
              onValueChange={setSimulatedPriceChange}
              min={-10}
              max={10}
              step={2.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-10%</span>
              <span>Current</span>
              <span>+10%</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">If you charge</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(currentSimulation.simulatedPrice)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">You'll sell</p>
              <p className="text-2xl font-bold">{currentSimulation.simulatedDemand} <span className="text-base font-normal">units</span></p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Revenue (30-day)</p>
              <p className="text-2xl font-bold">{formatCurrency(currentSimulation.simulatedRevenue)}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">Profit Margin:</span>
            <Badge variant={currentSimulation.profitMargin >= 20 ? "default" : currentSimulation.profitMargin >= 10 ? "secondary" : "destructive"}>
              {currentSimulation.profitMargin}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="revenue">Revenue Curve</TabsTrigger>
          <TabsTrigger value="demand">Demand Curve</TabsTrigger>
        </TabsList>
        
        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue at Different Price Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="priceChange" className="text-xs" />
                    <YAxis tickFormatter={(v) => `₱${(v/1000).toFixed(0)}K`} className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      labelFormatter={(label) => `Price Change: ${label}`}
                    />
                    <Bar 
                      dataKey="revenue" 
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                    <ReferenceLine 
                      x="0%" 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeDasharray="3 3"
                      label={{ value: 'Current', position: 'top', fontSize: 10 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="demand">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Price-Demand Relationship</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={demandCurveData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="price" tickFormatter={(v) => `₱${(v/1000).toFixed(0)}K`} className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      formatter={(value: number, name: string) => [value, name === 'demand' ? 'Units' : name]}
                      labelFormatter={(value) => `Price: ${formatCurrency(value)}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="demand" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Competitor Prices */}
      {analysis.competitorPrices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Competitor Price Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.competitorPrices.map((comp) => (
                <div key={comp.competitorName} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold">{comp.competitorName.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{comp.competitorName}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(comp.price)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant={comp.percentageDifference > 0 ? "destructive" : comp.percentageDifference < 0 ? "default" : "secondary"}
                      className="font-mono"
                    >
                      {comp.percentageDifference > 0 ? '+' : ''}{comp.percentageDifference}%
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {comp.priceDifference > 0 ? 'Higher' : comp.priceDifference < 0 ? 'Lower' : 'Same'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
