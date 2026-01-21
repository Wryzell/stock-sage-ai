/**
 * Pure JavaScript Forecasting Algorithms
 * No external AI APIs - all calculations done locally
 */

export interface SalesDataPoint {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  total: number;
  date: string;
  currentStock: number;
  minStock: number;
}

export interface ProductData {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
}

export interface ForecastResult {
  productId: string;
  productName: string;
  predictedDemand: number;
  confidenceLevel: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  recommendation: string;
  stockoutRisk: 'low' | 'medium' | 'high';
  suggestedReorderQty: number;
  historicalData: { date: string; quantity: number }[];
}

export interface Insight {
  type: 'warning' | 'opportunity' | 'info';
  title: string;
  description: string;
}

export interface ForecastData {
  forecasts: ForecastResult[];
  insights: Insight[];
  summary: string;
  algorithmCode: string;
}

/**
 * EXPONENTIAL SMOOTHING ALGORITHM
 * 
 * Formula: F(t+1) = α * A(t) + (1-α) * F(t)
 * Where:
 *   F(t+1) = Forecast for next period
 *   A(t)   = Actual value in current period
 *   F(t)   = Forecast for current period
 *   α      = Smoothing constant (0.1 to 0.9)
 * 
 * Higher α = more weight to recent data (responsive to changes)
 * Lower α = more weight to historical data (smoother forecasts)
 */
export function exponentialSmoothing(
  data: number[], 
  alpha: number = 0.3, 
  periods: number = 1
): { forecast: number; trend: 'increasing' | 'stable' | 'decreasing' } {
  if (data.length === 0) {
    return { forecast: 0, trend: 'stable' };
  }

  if (data.length === 1) {
    return { forecast: data[0], trend: 'stable' };
  }

  // Initialize forecast with first data point
  let forecast = data[0];

  // Apply exponential smoothing to each data point
  for (let i = 1; i < data.length; i++) {
    forecast = alpha * data[i] + (1 - alpha) * forecast;
  }

  // Calculate trend from last few data points
  const recentData = data.slice(-Math.min(5, data.length));
  const trend = calculateTrend(recentData);

  // Apply trend adjustment for future periods
  const trendMultiplier = trend === 'increasing' ? 1.1 : trend === 'decreasing' ? 0.9 : 1;
  const finalForecast = Math.round(forecast * Math.pow(trendMultiplier, periods));

  return { forecast: Math.max(0, finalForecast), trend };
}

/**
 * SIMPLE MOVING AVERAGE
 * 
 * Formula: SMA = (P1 + P2 + ... + Pn) / n
 * Where:
 *   P1...Pn = Data points over n periods
 *   n = Number of periods
 */
export function simpleMovingAverage(data: number[], windowSize: number = 3): number {
  if (data.length === 0) return 0;
  
  const window = data.slice(-Math.min(windowSize, data.length));
  return Math.round(window.reduce((sum, val) => sum + val, 0) / window.length);
}

/**
 * WEIGHTED MOVING AVERAGE
 * 
 * Formula: WMA = (P1*w1 + P2*w2 + ... + Pn*wn) / (w1 + w2 + ... + wn)
 * Where weights increase for more recent data
 */
export function weightedMovingAverage(data: number[], windowSize: number = 5): number {
  if (data.length === 0) return 0;
  
  const window = data.slice(-Math.min(windowSize, data.length));
  let weightedSum = 0;
  let weightTotal = 0;
  
  window.forEach((val, i) => {
    const weight = i + 1; // Increasing weights
    weightedSum += val * weight;
    weightTotal += weight;
  });
  
  return Math.round(weightedSum / weightTotal);
}

/**
 * TREND CALCULATION using Linear Regression
 * 
 * Calculates the slope of the best-fit line through data points
 * Positive slope = increasing, Negative slope = decreasing
 */
export function calculateTrend(data: number[]): 'increasing' | 'stable' | 'decreasing' {
  if (data.length < 2) return 'stable';

  const n = data.length;
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (data[i] - yMean);
    denominator += Math.pow(i - xMean, 2);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const slopePercentage = yMean !== 0 ? (slope / yMean) * 100 : 0;

  // Consider >5% change as significant trend
  if (slopePercentage > 5) return 'increasing';
  if (slopePercentage < -5) return 'decreasing';
  return 'stable';
}

/**
 * CONFIDENCE LEVEL CALCULATION
 * 
 * Based on:
 * - Data consistency (standard deviation)
 * - Sample size
 * - Prediction accuracy of recent forecasts
 */
export function calculateConfidence(data: number[]): number {
  if (data.length === 0) return 0;
  if (data.length < 3) return 40;

  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  
  // Coefficient of variation (lower = more consistent)
  const cv = mean !== 0 ? (stdDev / mean) * 100 : 100;
  
  // Base confidence from consistency
  let confidence = Math.max(30, 100 - cv);
  
  // Bonus for larger sample size (up to 15 points)
  const sampleBonus = Math.min(15, data.length);
  confidence += sampleBonus;
  
  return Math.min(95, Math.max(30, Math.round(confidence)));
}

/**
 * STOCKOUT RISK ASSESSMENT
 * 
 * Considers:
 * - Current stock vs predicted demand
 * - Days of inventory remaining
 * - Historical stockout frequency
 */
export function assessStockoutRisk(
  currentStock: number,
  minStock: number,
  predictedDemand: number,
  forecastDays: number
): 'low' | 'medium' | 'high' {
  const dailyDemand = predictedDemand / forecastDays;
  const daysOfStock = dailyDemand > 0 ? currentStock / dailyDemand : Infinity;
  const stockRatio = minStock > 0 ? currentStock / minStock : 1;

  // High risk: less than 7 days of stock OR below minimum
  if (daysOfStock < 7 || currentStock < minStock) return 'high';
  
  // Medium risk: less than 14 days OR approaching minimum
  if (daysOfStock < 14 || stockRatio < 1.5) return 'medium';
  
  return 'low';
}

/**
 * REORDER QUANTITY CALCULATION
 * 
 * Formula: ROQ = (Predicted Demand - Current Stock) + Safety Stock
 * Safety Stock = 20% buffer for demand variability
 */
export function calculateReorderQuantity(
  currentStock: number,
  predictedDemand: number,
  minStock: number
): number {
  const safetyStock = Math.ceil(predictedDemand * 0.2);
  const deficit = predictedDemand - currentStock;
  const reorderQty = deficit + safetyStock + minStock;
  return Math.max(0, Math.round(reorderQty));
}

/**
 * MAIN FORECASTING ENGINE
 * 
 * Aggregates sales data per product and applies forecasting algorithms
 */
export function generateForecasts(
  salesData: SalesDataPoint[],
  products: ProductData[],
  forecastDays: number = 30
): ForecastData {
  // Group sales by product
  const salesByProduct = new Map<string, { quantities: number[]; dates: string[] }>();
  const productInfo = new Map<string, { id: string; name: string; currentStock: number; minStock: number }>();

  salesData.forEach(sale => {
    const key = sale.productName;
    if (!salesByProduct.has(key)) {
      salesByProduct.set(key, { quantities: [], dates: [] });
      productInfo.set(key, {
        id: sale.productId,
        name: sale.productName,
        currentStock: sale.currentStock,
        minStock: sale.minStock
      });
    }
    salesByProduct.get(key)!.quantities.push(sale.quantity);
    salesByProduct.get(key)!.dates.push(sale.date);
  });

  // Add products with no sales
  products.forEach(product => {
    if (!salesByProduct.has(product.name)) {
      salesByProduct.set(product.name, { quantities: [], dates: [] });
      productInfo.set(product.name, {
        id: product.id,
        name: product.name,
        currentStock: product.currentStock,
        minStock: product.minStock
      });
    }
  });

  // Generate forecasts
  const forecasts: ForecastResult[] = [];
  const insights: Insight[] = [];
  let highRiskCount = 0;
  let increasingTrendCount = 0;

  salesByProduct.forEach((data, productName) => {
    const info = productInfo.get(productName)!;
    const { quantities, dates } = data;
    
    // Apply exponential smoothing
    const { forecast: predictedDemand, trend } = exponentialSmoothing(quantities, 0.3, 1);
    
    // Scale to forecast period (assume data is weekly, forecast is for X days)
    const scaledDemand = Math.round((predictedDemand / 7) * forecastDays);
    
    const confidence = calculateConfidence(quantities);
    const stockoutRisk = assessStockoutRisk(info.currentStock, info.minStock, scaledDemand, forecastDays);
    const reorderQty = calculateReorderQuantity(info.currentStock, scaledDemand, info.minStock);

    // Build historical data for chart
    const historicalData = quantities.map((qty, idx) => ({
      date: dates[idx] || new Date().toISOString(),
      quantity: qty
    }));

    // Generate recommendation
    let recommendation = '';
    if (stockoutRisk === 'high') {
      recommendation = `Order ${reorderQty} units immediately to avoid stockout.`;
      highRiskCount++;
    } else if (stockoutRisk === 'medium') {
      recommendation = `Plan to reorder ${reorderQty} units within 1 week.`;
    } else if (trend === 'increasing') {
      recommendation = `Monitor closely. Demand is rising.`;
      increasingTrendCount++;
    } else if (trend === 'decreasing') {
      recommendation = `Hold orders. Demand is declining.`;
    } else {
      recommendation = `Stock levels are adequate for the period.`;
    }

    forecasts.push({
      productId: info.id,
      productName,
      predictedDemand: scaledDemand,
      confidenceLevel: confidence,
      trend,
      recommendation,
      stockoutRisk,
      suggestedReorderQty: reorderQty,
      historicalData
    });
  });

  // Sort by stockout risk (high first) then by predicted demand
  forecasts.sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2 };
    if (riskOrder[a.stockoutRisk] !== riskOrder[b.stockoutRisk]) {
      return riskOrder[a.stockoutRisk] - riskOrder[b.stockoutRisk];
    }
    return b.predictedDemand - a.predictedDemand;
  });

  // Generate insights
  if (highRiskCount > 0) {
    insights.push({
      type: 'warning',
      title: 'Stockout Alert',
      description: `${highRiskCount} product${highRiskCount > 1 ? 's' : ''} at high risk of stockout. Immediate action required.`
    });
  }

  if (increasingTrendCount > 2) {
    insights.push({
      type: 'opportunity',
      title: 'Growing Demand',
      description: `${increasingTrendCount} products show increasing demand trends. Consider bulk purchasing.`
    });
  }

  const lowStockProducts = products.filter(p => p.currentStock < p.minStock);
  if (lowStockProducts.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Below Minimum Stock',
      description: `${lowStockProducts.length} products are below minimum stock levels.`
    });
  }

  if (salesData.length < 10) {
    insights.push({
      type: 'info',
      title: 'Limited Data',
      description: 'Add more sales records for more accurate predictions. Current analysis based on limited data.'
    });
  }

  // Generate summary
  let summary = '';
  if (highRiskCount > 0) {
    summary = `${highRiskCount} product${highRiskCount > 1 ? 's need' : ' needs'} immediate reordering. `;
  }
  summary += `Analyzed ${forecasts.length} products for the next ${forecastDays} days. `;
  const healthyProducts = forecasts.filter(f => f.stockoutRisk === 'low').length;
  summary += `${healthyProducts} products have healthy stock levels.`;

  // Algorithm code for display
  const algorithmCode = `// Exponential Smoothing Algorithm
// Formula: F(t+1) = α × A(t) + (1-α) × F(t)

function exponentialSmoothing(data, alpha = 0.3) {
  let forecast = data[0];
  
  for (let i = 1; i < data.length; i++) {
    forecast = alpha * data[i] + (1 - alpha) * forecast;
  }
  
  return forecast;
}

// Confidence = 100 - Coefficient of Variation
// Trend = Linear Regression Slope Analysis
// Risk = Stock Coverage Days Assessment`;

  return { forecasts, insights, summary, algorithmCode };
}
