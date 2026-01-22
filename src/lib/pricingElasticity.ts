/**
 * Pricing Elasticity & Demand Simulation Algorithms
 * Calculates price elasticity and simulates demand at different price points
 */

export interface SalesDataPoint {
  productId: string;
  quantity: number;
  unitPrice: number;
  saleDate: string;
}

export interface ElasticityResult {
  productId: string;
  productName: string;
  elasticity: number;
  elasticityType: 'elastic' | 'inelastic' | 'unit_elastic';
  currentPrice: number;
  currentDemand: number;
  optimalPrice: number;
  optimalDemand: number;
  optimalRevenue: number;
  confidenceLevel: number;
}

export interface PriceSimulation {
  priceChange: number; // -10% to +10%
  simulatedPrice: number;
  simulatedDemand: number;
  simulatedRevenue: number;
  profitMargin: number;
}

export interface CompetitorPrice {
  competitorName: string;
  price: number;
  priceDifference: number;
  percentageDifference: number;
}

export interface PricingAnalysis {
  productId: string;
  productName: string;
  currentPrice: number;
  costPrice: number;
  elasticity: ElasticityResult;
  simulations: PriceSimulation[];
  competitorPrices: CompetitorPrice[];
  recommendation: string;
  optimalPrice: number;
  expectedDemand: number;
  expectedRevenue: number;
}

/**
 * PRICE ELASTICITY OF DEMAND (PED) CALCULATION
 * 
 * Formula: PED = (% Change in Quantity Demanded) / (% Change in Price)
 * 
 * Where:
 *   % Change in Quantity = (Q2 - Q1) / ((Q2 + Q1) / 2) * 100
 *   % Change in Price = (P2 - P1) / ((P2 + P1) / 2) * 100
 * 
 * Interpretation:
 *   |PED| > 1: Elastic (demand sensitive to price changes)
 *   |PED| < 1: Inelastic (demand not sensitive to price changes)
 *   |PED| = 1: Unit elastic
 */
export function calculatePriceElasticity(
  salesData: SalesDataPoint[]
): { elasticity: number; confidence: number } {
  if (salesData.length < 2) {
    return { elasticity: -1, confidence: 30 }; // Default assumption: elastic
  }

  // Sort by date to get chronological order
  const sortedData = [...salesData].sort(
    (a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()
  );

  // Calculate elasticity using midpoint method for each price change
  const elasticities: number[] = [];
  
  for (let i = 1; i < sortedData.length; i++) {
    const prev = sortedData[i - 1];
    const curr = sortedData[i];
    
    // Skip if prices are the same
    if (prev.unitPrice === curr.unitPrice) continue;
    
    // Midpoint method for percentage changes
    const avgQuantity = (curr.quantity + prev.quantity) / 2;
    const avgPrice = (curr.unitPrice + prev.unitPrice) / 2;
    
    const quantityChange = ((curr.quantity - prev.quantity) / avgQuantity) * 100;
    const priceChange = ((curr.unitPrice - prev.unitPrice) / avgPrice) * 100;
    
    if (priceChange !== 0) {
      const ped = quantityChange / priceChange;
      elasticities.push(ped);
    }
  }

  if (elasticities.length === 0) {
    // No price variations found, estimate based on category averages
    return { elasticity: -1.2, confidence: 40 };
  }

  // Calculate average elasticity
  const avgElasticity = elasticities.reduce((sum, e) => sum + e, 0) / elasticities.length;
  
  // Calculate confidence based on data consistency
  const variance = elasticities.reduce((sum, e) => sum + Math.pow(e - avgElasticity, 2), 0) / elasticities.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = Math.abs(avgElasticity) > 0 ? stdDev / Math.abs(avgElasticity) : 1;
  
  let confidence = Math.max(30, Math.min(95, 100 - coefficientOfVariation * 50));
  confidence += Math.min(20, elasticities.length * 2); // Bonus for more data points
  confidence = Math.min(95, confidence);

  return { elasticity: avgElasticity, confidence };
}

/**
 * DEMAND SIMULATION
 * 
 * Simulates demand at different price points using the elasticity coefficient
 * 
 * Formula: Q2 = Q1 * (1 + PED * (P2 - P1) / P1)
 */
export function simulateDemand(
  currentPrice: number,
  currentDemand: number,
  newPrice: number,
  elasticity: number
): number {
  const priceChangePercent = (newPrice - currentPrice) / currentPrice;
  const demandChange = elasticity * priceChangePercent;
  const newDemand = currentDemand * (1 + demandChange);
  return Math.max(0, Math.round(newDemand));
}

/**
 * OPTIMAL PRICE CALCULATION
 * 
 * For a linear demand curve, optimal price for revenue maximization:
 * P_optimal = P_current * (PED / (PED + 1))
 * 
 * For elastic goods (PED < -1), lowering price increases revenue
 * For inelastic goods (PED > -1), raising price increases revenue
 */
export function calculateOptimalPrice(
  currentPrice: number,
  elasticity: number,
  costPrice: number,
  minMargin: number = 0.1 // 10% minimum margin
): number {
  // Ensure we don't divide by zero or get negative prices
  if (elasticity >= -0.1) {
    // Very inelastic, price can be raised significantly
    return Math.round(currentPrice * 1.15); // 15% increase
  }

  // Calculate revenue-maximizing price
  const optimalMultiplier = elasticity / (elasticity + 1);
  let optimalPrice = currentPrice * optimalMultiplier;
  
  // Ensure minimum margin is maintained
  const minPrice = costPrice * (1 + minMargin);
  optimalPrice = Math.max(optimalPrice, minPrice);
  
  // Cap at reasonable bounds (50% below to 50% above current)
  optimalPrice = Math.max(currentPrice * 0.5, Math.min(currentPrice * 1.5, optimalPrice));
  
  return Math.round(optimalPrice);
}

/**
 * GENERATE PRICE SIMULATIONS
 * 
 * Creates demand simulations for price changes from -10% to +10%
 */
export function generatePriceSimulations(
  currentPrice: number,
  currentDemand: number,
  costPrice: number,
  elasticity: number
): PriceSimulation[] {
  const simulations: PriceSimulation[] = [];
  const priceChanges = [-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10];

  for (const change of priceChanges) {
    const simulatedPrice = Math.round(currentPrice * (1 + change / 100));
    const simulatedDemand = simulateDemand(currentPrice, currentDemand, simulatedPrice, elasticity);
    const simulatedRevenue = simulatedPrice * simulatedDemand;
    const profit = (simulatedPrice - costPrice) * simulatedDemand;
    const profitMargin = simulatedRevenue > 0 ? (profit / simulatedRevenue) * 100 : 0;

    simulations.push({
      priceChange: change,
      simulatedPrice,
      simulatedDemand,
      simulatedRevenue,
      profitMargin: Math.round(profitMargin * 10) / 10,
    });
  }

  return simulations;
}

/**
 * COMPETITOR PRICE ANALYSIS
 */
export function analyzeCompetitorPrices(
  ourPrice: number,
  competitors: { competitorName: string; price: number }[]
): CompetitorPrice[] {
  return competitors.map(comp => ({
    competitorName: comp.competitorName,
    price: comp.price,
    priceDifference: ourPrice - comp.price,
    percentageDifference: Math.round(((ourPrice - comp.price) / comp.price) * 100 * 10) / 10,
  }));
}

/**
 * GENERATE PRICING RECOMMENDATION
 */
export function generateRecommendation(
  elasticity: number,
  currentPrice: number,
  optimalPrice: number,
  competitorPrices: CompetitorPrice[]
): string {
  const elasticityType = Math.abs(elasticity) > 1 ? 'elastic' : 'inelastic';
  const priceChangeNeeded = ((optimalPrice - currentPrice) / currentPrice) * 100;
  
  // Average competitor price
  const avgCompetitorPrice = competitorPrices.length > 0
    ? competitorPrices.reduce((sum, c) => sum + c.price, 0) / competitorPrices.length
    : currentPrice;
  
  const vsCompetitors = ((currentPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100;

  let recommendation = '';

  if (elasticityType === 'elastic') {
    if (priceChangeNeeded < -5) {
      recommendation = `Demand is price-sensitive. Lower price by ${Math.abs(Math.round(priceChangeNeeded))}% to ₱${optimalPrice.toLocaleString()} to maximize revenue.`;
    } else if (priceChangeNeeded > 5) {
      recommendation = `Despite elastic demand, margin optimization suggests a ${Math.round(priceChangeNeeded)}% price increase to ₱${optimalPrice.toLocaleString()}.`;
    } else {
      recommendation = `Current pricing is near optimal. Monitor competitor pricing closely due to elastic demand.`;
    }
  } else {
    if (priceChangeNeeded > 5) {
      recommendation = `Demand is stable. Increase price by ${Math.round(priceChangeNeeded)}% to ₱${optimalPrice.toLocaleString()} for higher margins.`;
    } else {
      recommendation = `Inelastic demand indicates pricing power. Current price is acceptable but a slight increase could improve margins.`;
    }
  }

  // Add competitor context
  if (competitorPrices.length > 0) {
    if (vsCompetitors > 10) {
      recommendation += ` Note: You're ${Math.round(vsCompetitors)}% above competitor average.`;
    } else if (vsCompetitors < -10) {
      recommendation += ` Opportunity: You're ${Math.abs(Math.round(vsCompetitors))}% below competitor average.`;
    }
  }

  return recommendation;
}

/**
 * MAIN PRICING ANALYSIS ENGINE
 */
export function analyzePricing(
  productId: string,
  productName: string,
  currentPrice: number,
  costPrice: number,
  salesData: SalesDataPoint[],
  competitorData: { competitorName: string; price: number }[]
): PricingAnalysis {
  // Calculate current demand (average recent sales)
  const recentSales = salesData.filter(s => s.productId === productId);
  const currentDemand = recentSales.length > 0
    ? Math.round(recentSales.reduce((sum, s) => sum + s.quantity, 0) / Math.max(1, recentSales.length) * 30) // Monthly estimate
    : 10; // Default assumption

  // Calculate elasticity
  const { elasticity, confidence } = calculatePriceElasticity(
    recentSales.map(s => ({
      productId: s.productId,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      saleDate: s.saleDate,
    }))
  );

  // Calculate optimal price
  const optimalPrice = calculateOptimalPrice(currentPrice, elasticity, costPrice);
  const optimalDemand = simulateDemand(currentPrice, currentDemand, optimalPrice, elasticity);
  const optimalRevenue = optimalPrice * optimalDemand;

  // Determine elasticity type
  const elasticityType: 'elastic' | 'inelastic' | 'unit_elastic' = 
    Math.abs(elasticity) > 1.1 ? 'elastic' : 
    Math.abs(elasticity) < 0.9 ? 'inelastic' : 'unit_elastic';

  const elasticityResult: ElasticityResult = {
    productId,
    productName,
    elasticity,
    elasticityType,
    currentPrice,
    currentDemand,
    optimalPrice,
    optimalDemand,
    optimalRevenue,
    confidenceLevel: confidence,
  };

  // Generate simulations
  const simulations = generatePriceSimulations(currentPrice, currentDemand, costPrice, elasticity);

  // Analyze competitor prices
  const competitorPrices = analyzeCompetitorPrices(currentPrice, competitorData);

  // Generate recommendation
  const recommendation = generateRecommendation(elasticity, currentPrice, optimalPrice, competitorPrices);

  // Expected values at optimal price
  const expectedDemand = optimalDemand;
  const expectedRevenue = optimalRevenue;

  return {
    productId,
    productName,
    currentPrice,
    costPrice,
    elasticity: elasticityResult,
    simulations,
    competitorPrices,
    recommendation,
    optimalPrice,
    expectedDemand,
    expectedRevenue,
  };
}
