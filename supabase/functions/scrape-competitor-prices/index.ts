const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductToScrape {
  id: string;
  name: string;
  searchTerm: string;
}

interface ScrapedPrice {
  productId: string;
  productName: string;
  competitor: string;
  price: number | null;
  source: string;
  error?: string;
}

// Map of our product names to search-friendly terms
const SEARCH_TERM_MAP: Record<string, string> = {
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
  'PC Chub Monitor – 22"': 'PC Chub 22 inch monitor',
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
  'Board – Byson WiFi': 'Byson WiFi motherboard',
  // RAM
  '8GB RAM': '8GB DDR4 desktop RAM',
  // Storage
  '120GB SSD': '120GB SATA SSD',
  '240GB SSD': '240GB SATA SSD',
  'Ovation 240GB': 'Ovation 240GB SSD',
  'Ovation 240GB SSD': 'Ovation 240GB SSD',
  // PSU
  '450W PSU': '450W power supply unit',
  '550W PSU': '550W power supply unit',
  '600W PSU': '600W power supply unit',
  'Ovation 550 PSU': 'Ovation 550W power supply',
  'Ovation – 550 PSU': 'Ovation 550W power supply',
  'HP 450 Pro Lite': 'HP 450W power supply',
  'Battle Star NP930 RGB': 'Battle Star NP930 RGB PSU',
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
  'MT-001': 'MT-001 mouse',
  'Lenovo Mouse': 'Lenovo USB mouse',
  // Speakers
  'E3M': 'E3M PC speaker',
  'B12': 'B12 PC speaker',
  'SPK685': 'SPK685 speaker',
  // External Case
  '2.5" HDD': '2.5 inch HDD enclosure',
  // Chargers
  'Universal Type-C': 'Universal Type-C laptop charger',
  'Acer 65W 19V': 'Acer 65W 19V laptop charger',
  'Asus 45W 19V': 'Asus 45W 19V laptop charger',
  'Asus 65W 20V': 'Asus 65W 20V laptop charger',
  'Lenovo 45W 20V': 'Lenovo 45W 20V laptop charger',
  'HP 45W 19V': 'HP 45W 19V laptop charger',
  // Headset
  'H110COK': 'H110 headset',
  'Hyper Sound S80x': 'Hyper Sound S80x headset',
  // Camera
  'Inplay Camera': 'Inplay webcam',
  'Ovation Camera': 'Ovation webcam',
  // Router
  'EW-300N': 'EW-300N wireless router',
  'EW-150N': 'EW-150N wireless router',
  // USB / Storage
  '32GB iKey': '32GB USB flash drive',
  'USB Flashdrive 32GB': '32GB USB flash drive',
  'USB Flashdrive 128GB': '128GB USB flash drive',
  'Seagate External 500GB': 'Seagate 500GB external hard drive',
  // Cables
  'HDMI': 'HDMI cable',
  'VGA to HDMI': 'VGA to HDMI adapter cable',
};

// Extract price from HTML content - improved accuracy
function extractPrice(text: string): number | null {
  // Look for prices with peso symbol or PHP prefix - these are most reliable
  const pricePatterns = [
    // ₱ followed by price with comma separators
    /₱\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)/g,
    // PHP followed by price
    /PHP\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)/gi,
    // Price followed by .00 (common in PH retail)
    /(\d{1,3}(?:,\d{3})+)\.00/g,
    // P followed by 4+ digit price (to avoid matching model numbers)
    /P\s*(\d{4,}(?:,\d{3})*(?:\.\d{2})?)/g,
  ];

  const prices: number[] = [];

  for (const pattern of pricePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const priceStr = match[1].replace(/,/g, '');
      const price = parseFloat(priceStr);
      // Filter: realistic Philippine retail prices (₱500 to ₱200,000)
      if (price >= 500 && price <= 200000) {
        prices.push(price);
      }
    }
  }

  if (prices.length === 0) {
    return null;
  }

  // Return the lowest price found (usually the sale/promo price)
  return Math.min(...prices);
}

// Scrape Octagon PH
async function scrapeOctagon(
  productName: string,
  searchTerm: string,
  apiKey: string
): Promise<{ price: number | null; source: string; error?: string }> {
  const url = `https://octagon.com.ph/catalogsearch/result/?q=${encodeURIComponent(searchTerm)}`;

  try {
    console.log(`[Octagon] Searching: ${searchTerm}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error(`[Octagon] API error:`, data);
      return { price: null, source: url, error: data.error || 'Failed to scrape' };
    }

    const markdown = data.data?.markdown || data.markdown || '';
    const price = extractPrice(markdown);
    
    console.log(`[Octagon] Found price: ${price} for ${productName}`);
    return { price, source: url };
  } catch (error) {
    console.error(`[Octagon] Error:`, error);
    return { price: null, source: url, error: String(error) };
  }
}

// Scrape Villman
async function scrapeVillman(
  productName: string,
  searchTerm: string,
  apiKey: string
): Promise<{ price: number | null; source: string; error?: string }> {
  const url = `https://villman.com/search?q=${encodeURIComponent(searchTerm)}`;

  try {
    console.log(`[Villman] Searching: ${searchTerm}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error(`[Villman] API error:`, data);
      return { price: null, source: url, error: data.error || 'Failed to scrape' };
    }

    const markdown = data.data?.markdown || data.markdown || '';
    const price = extractPrice(markdown);
    
    console.log(`[Villman] Found price: ${price} for ${productName}`);
    return { price, source: url };
  } catch (error) {
    console.error(`[Villman] Error:`, error);
    return { price: null, source: url, error: String(error) };
  }
}

// Scrape PC Express
async function scrapePCExpress(
  productName: string,
  searchTerm: string,
  apiKey: string
): Promise<{ price: number | null; source: string; error?: string }> {
  const url = `https://pcx.com.ph/search?q=${encodeURIComponent(searchTerm)}`;

  try {
    console.log(`[PC Express] Searching: ${searchTerm}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error(`[PC Express] API error:`, data);
      return { price: null, source: url, error: data.error || 'Failed to scrape' };
    }

    const markdown = data.data?.markdown || data.markdown || '';
    const price = extractPrice(markdown);
    
    console.log(`[PC Express] Found price: ${price} for ${productName}`);
    return { price, source: url };
  } catch (error) {
    console.error(`[PC Express] Error:`, error);
    return { price: null, source: url, error: String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { products, competitors } = await req.json() as {
      products: ProductToScrape[];
      competitors?: string[];
    };

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Products array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured. Please connect it in Settings → Connectors.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const selectedCompetitors = competitors || ['Octagon', 'Villman', 'PC Express'];
    const results: ScrapedPrice[] = [];

    console.log(`Starting scrape for ${products.length} products across ${selectedCompetitors.length} competitors`);

    for (const product of products) {
      const searchTerm = product.searchTerm || SEARCH_TERM_MAP[product.name] || product.name;
      
      for (const competitor of selectedCompetitors) {
        let result: { price: number | null; source: string; error?: string };
        
        switch (competitor) {
          case 'Octagon':
            result = await scrapeOctagon(product.name, searchTerm, apiKey);
            break;
          case 'Villman':
            result = await scrapeVillman(product.name, searchTerm, apiKey);
            break;
          case 'PC Express':
            result = await scrapePCExpress(product.name, searchTerm, apiKey);
            break;
          default:
            result = { price: null, source: '', error: 'Unknown competitor' };
        }

        results.push({
          productId: product.id,
          productName: product.name,
          competitor,
          price: result.price,
          source: result.source,
          error: result.error,
        });

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    const successful = results.filter(r => r.price !== null).length;
    const failed = results.filter(r => r.price === null).length;

    console.log(`Scraping complete: ${successful} found, ${failed} not found`);

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        summary: {
          total: results.length,
          successful,
          failed,
          products: products.length,
          competitors: selectedCompetitors.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scraper:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
