import { supabase } from '@/integrations/supabase/client';

export interface ProductToScrape {
  id: string;
  name: string;
  searchTerm?: string;
}

export interface ScrapedPrice {
  productId: string;
  productName: string;
  competitor: string;
  price: number | null;
  source: string;
  error?: string;
}

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

// Product name to search term mapping for better results
export const PRODUCT_SEARCH_TERMS: Record<string, string> = {
  // Laptops
  'Dell Latitude 7420 i5': 'Dell Latitude 7420',
  'Dell Latitude 5320 i7': 'Dell Latitude 5320',
  'Dell Latitude 5720 i5': 'Dell Latitude 5720',
  'HP Elitebook 640 G5 i7': 'HP Elitebook 640 G5',
  // CPUs
  'i5-10600': 'Intel Core i5 10600',
  'R3-2200G Pro': 'AMD Ryzen 3 2200G',
  'R5-2400GE': 'AMD Ryzen 5 2400G',
  // GPUs
  'GT 730': 'GeForce GT 730',
  '4000GTI': 'Quadro 4000',
  'R5-230': 'Radeon R5 230',
  '1660 Super': 'GTX 1660 Super',
  // Motherboards
  'B450M MSI PRO': 'MSI B450M PRO',
  'B450 board': 'B450 motherboard',
  // RAM
  '8GB RAM': '8GB DDR4 RAM',
  // Storage
  '120GB SSD': '120GB SSD',
  '240GB SSD': '240GB SSD',
  // PSU
  '450W PSU': '450W power supply',
  '550W PSU': '550W power supply',
  '600W PSU': '600W power supply',
  // Cases
  'Gundam case': 'Gundam PC case',
  'T400 case': 'T400 PC case',
  'Ovation case': 'Ovation PC case',
};

export type Competitor = 'Octagon' | 'Villman' | 'PC Express';

export const ALL_COMPETITORS: Competitor[] = ['Octagon', 'Villman', 'PC Express'];

/**
 * Scrape competitor prices for given products
 */
export async function scrapeCompetitorPrices(
  products: ProductToScrape[],
  competitors?: Competitor[]
): Promise<ScrapeResult> {
  try {
    // Add search terms based on product names
    const productsWithTerms = products.map(p => ({
      ...p,
      searchTerm: p.searchTerm || PRODUCT_SEARCH_TERMS[p.name] || p.name,
    }));

    const { data, error } = await supabase.functions.invoke('scrape-competitor-prices', {
      body: {
        products: productsWithTerms,
        competitors: competitors || ALL_COMPETITORS,
      },
    });

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

/**
 * Save scraped prices to database
 */
export async function saveScrapedPrices(
  prices: ScrapedPrice[],
  recordedBy?: string
): Promise<{ success: boolean; saved: number; errors: number }> {
  const validPrices = prices.filter(p => p.price !== null && p.price > 0);
  let saved = 0;
  let errors = 0;

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

  return { success: errors === 0, saved, errors };
}
