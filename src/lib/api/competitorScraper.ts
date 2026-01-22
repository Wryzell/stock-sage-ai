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
  'Dell Latitude 7420 i5': 'Dell Latitude 7420 laptop',
  'Dell Latitude 7420 i5 – 8GB': 'Dell Latitude 7420 laptop',
  'Dell Latitude 5320 i7': 'Dell Latitude 5320 laptop',
  'Dell Latitude 5320 i7 – 8GB': 'Dell Latitude 5320 laptop',
  'Dell Latitude 5720 i5': 'Dell Latitude 5720 laptop',
  'Dell Latitude 5720 i5 – 8GB': 'Dell Latitude 5720 laptop',
  'HP Elitebook 640 G5 i7': 'HP Elitebook 640 G5 laptop',
  'HP Elitebook 640 G5 i7 – 8GB': 'HP Elitebook 640 G5 laptop',
  // Monitors
  'Nvision N27SF IPS': 'Nvision N27SF monitor',
  'Nvision – N27SF IPS': 'Nvision N27SF monitor',
  'Viewpoint 24" LED': 'Viewpoint 24 inch LED monitor',
  'Viewpoint – 24" LED': 'Viewpoint 24 inch LED monitor',
  'PC Chub Monitor 22"': 'PC Chub 22 inch monitor',
  // Printer
  'Canon PIXMA MG2570S': 'Canon PIXMA MG2570S printer',
  'Canon – PIXMA MG2570S': 'Canon PIXMA MG2570S printer',
  // CPUs
  'i5-10600': 'Intel Core i5-10600 processor',
  'R3-2200G Pro': 'AMD Ryzen 3 2200G processor',
  'R5-2400GE': 'AMD Ryzen 5 2400GE processor',
  // GPUs
  'GT 730': 'NVIDIA GeForce GT 730 graphics card',
  '4000GTI': 'NVIDIA Quadro 4000 graphics card',
  'R5-230': 'AMD Radeon R5 230 graphics card',
  '1660 Super': 'NVIDIA GTX 1660 Super graphics card',
  // Motherboards
  'B450M MSI PRO': 'MSI B450M PRO-VDH motherboard',
  'B450 board': 'B450 motherboard',
  // RAM
  '8GB RAM': '8GB DDR4 desktop RAM',
  // Storage
  '120GB SSD': '120GB SATA SSD',
  '240GB SSD': '240GB SATA SSD',
  'Ovation 240GB': 'Ovation 240GB SSD',
  // PSU
  '450W PSU': '450W power supply unit',
  '550W PSU': '550W power supply unit',
  '600W PSU': '600W power supply unit',
  'Ovation 550 PSU': 'Ovation 550W power supply',
  // Cases
  'Gundam': 'Gundam PC case',
  'T400 case white': 'T400 white PC case',
  'Ovation': 'Ovation PC case',
  // Keyboards
  'HP KB5100': 'HP KB5100 keyboard',
  'Happon Keyboard': 'Happon keyboard',
  'DT-490A': 'DT-490A keyboard',
  // Mouse
  'Optical Mouse': 'USB optical mouse',
  'Lenovo Mouse': 'Lenovo USB mouse',
  // Speakers
  'E3M': 'E3M PC speaker',
  'SPK685': 'SPK685 speaker',
  // Chargers
  'Acer 65W 19V': 'Acer 65W laptop charger',
  'Asus 45W 19V': 'Asus 45W laptop charger',
  'Lenovo 45W 20V': 'Lenovo 45W laptop charger',
  'HP 45W 19V': 'HP 45W laptop charger',
  // Headset
  'H110COK': 'H110 headset',
  'Hyper Sound S80x': 'Hyper Sound S80x headset',
  // Router
  'EW-300N': 'EW-300N wireless router',
  'EW-150N': 'EW-150N wireless router',
  // Storage
  'Seagate External 500GB': 'Seagate 500GB external hard drive',
  'USB Flashdrive 32GB': '32GB USB flash drive',
  'USB Flashdrive 128GB': '128GB USB flash drive',
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
