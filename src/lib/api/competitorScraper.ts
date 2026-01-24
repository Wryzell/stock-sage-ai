// ==========================================
// COMPETITOR PRICE SCRAPER - Frontend API
// ==========================================
// This file handles calling the edge function to scrape
// competitor prices and saving results to the database.
// ==========================================

import { supabase } from '@/integrations/supabase/client';

// ==========================================
// TYPES - Define the shape of our data
// ==========================================

/**
 * A product that needs price scraping
 */
export interface ProductToScrape {
  id: string;
  name: string;
  category: string;  // Required for automatic search term generation
}

/**
 * The result of scraping a single product from one competitor
 */
export interface ScrapedPrice {
  productId: string;
  productName: string;
  competitor: string;
  price: number | null;  // null if price wasn't found
  source: string;        // URL that was scraped
  error?: string;        // Error message if scraping failed
}

/**
 * The overall result of a scraping operation
 */
export interface ScrapeResult {
  success: boolean;
  data?: ScrapedPrice[];
  summary?: {
    total: number;
    successful: number;
    failed: number;
    products: number;
    competitors: number;
  };
  error?: string;
}

/**
 * Scan modes:
 * - quick: Only scrape products that haven't been scraped recently
 * - full: Scrape all products regardless of existing data
 */
export type ScanMode = 'quick' | 'full';

/**
 * Available competitors to scrape
 */
export type Competitor = 'Octagon' | 'Villman' | 'PC Express';

export const ALL_COMPETITORS: Competitor[] = ['Octagon', 'Villman', 'PC Express'];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get products that need price scraping (haven't been scraped recently)
 * 
 * @param products - List of all products
 * @param maxAgeHours - Maximum age of existing data (default: 24 hours)
 * @returns Products that need to be scraped
 * 
 * Example:
 *   const needsScrape = await getProductsNeedingScrape(allProducts, 24);
 *   // Returns products without price data in the last 24 hours
 */
export async function getProductsNeedingScrape(
  products: ProductToScrape[],
  maxAgeHours: number = 24
): Promise<ProductToScrape[]> {
  try {
    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);
    
    // Get products that have been scraped recently
    const { data: recentPrices } = await supabase
      .from('competitor_prices')
      .select('product_id, recorded_at')
      .gte('recorded_at', cutoffDate.toISOString());
    
    // Create a set of product IDs with recent prices
    const recentProductIds = new Set(
      (recentPrices || []).map(p => p.product_id)
    );
    
    // Return only products that DON'T have recent prices
    return products.filter(p => !recentProductIds.has(p.id));
  } catch (error) {
    console.error('Error checking recent prices:', error);
    return products; // Fall back to all products if there's an error
  }
}

// ==========================================
// MAIN SCRAPING FUNCTION
// ==========================================

/**
 * Scrape competitor prices for given products
 * 
 * This calls the edge function which:
 * 1. Automatically generates search terms from product names
 * 2. Scrapes each competitor website
 * 3. Extracts prices from the results
 * 
 * @param products - Products to scrape (must include id, name, and category)
 * @param competitors - Which competitors to scrape (default: all)
 * @param scanMode - 'quick' or 'full' scan mode
 * @returns Scrape results with prices
 * 
 * Example:
 *   const result = await scrapeCompetitorPrices(products, ['Octagon'], 'quick');
 *   if (result.success) {
 *     console.log(`Found ${result.summary.successful} prices`);
 *   }
 */
export async function scrapeCompetitorPrices(
  products: ProductToScrape[],
  competitors?: Competitor[],
  scanMode?: ScanMode
): Promise<ScrapeResult> {
  try {
    // Call the edge function
    const { data, error } = await supabase.functions.invoke('scrape-competitor-prices', {
      body: {
        products,  // The edge function will auto-generate search terms
        competitors: competitors || ALL_COMPETITORS,
        scanMode: scanMode || 'full',
      },
    });

    // Handle errors
    if (error) {
      console.error('Scrape error:', error);
      return { success: false, error: error.message };
    }

    return data as ScrapeResult;
  } catch (error) {
    console.error('Scrape error:', error);
    return { success: false, error: String(error) };
  }
}

// ==========================================
// DATABASE FUNCTIONS
// ==========================================

/**
 * Save scraped prices to the database
 * 
 * Only saves prices that are valid (not null and greater than 0).
 * 
 * @param prices - Array of scraped prices to save
 * @param recordedBy - User ID of who initiated the scrape
 * @returns Summary of saved/failed records
 * 
 * Example:
 *   const result = await saveScrapedPrices(scrapedPrices, userId);
 *   console.log(`Saved ${result.saved} prices`);
 */
export async function saveScrapedPrices(
  prices: ScrapedPrice[],
  recordedBy?: string
): Promise<{ success: boolean; saved: number; errors: number }> {
  // Filter out invalid prices
  const validPrices = prices.filter(p => p.price !== null && p.price > 0);
  
  let saved = 0;
  let errors = 0;

  // Save each valid price to the database
  for (const price of validPrices) {
    const { error } = await supabase
      .from('competitor_prices')
      .insert({
        product_id: price.productId,
        product_name: price.productName,
        competitor_name: price.competitor,
        price: price.price!,
        source_url: price.source,
        recorded_by: recordedBy,
      });

    if (error) {
      console.error(`Failed to save price for ${price.productName}:`, error);
      errors++;
    } else {
      saved++;
    }
  }

  return { 
    success: errors === 0, 
    saved, 
    errors 
  };
}
