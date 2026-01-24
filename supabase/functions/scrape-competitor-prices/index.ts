// ==========================================
// COMPETITOR PRICE SCRAPER - Edge Function
// ==========================================
// This function scrapes competitor websites to find product prices.
// It uses Firecrawl API to fetch and parse web pages.
// ==========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// TYPES - Define the shape of our data
// ==========================================

interface ProductToScrape {
  id: string;
  name: string;
  category: string;  // Product category from database
  searchTerm?: string;  // Optional custom search term
}

interface ScrapedPrice {
  productId: string;
  productName: string;
  competitor: string;
  price: number | null;
  source: string;
  error?: string;
}

// ==========================================
// AUTOMATIC SEARCH TERM GENERATOR
// ==========================================
// This function automatically creates search-friendly terms
// from product names. No need to add new products manually!
// ==========================================

/**
 * Cleans up a product name for better search results
 * Example: "Dell Latitude 7420 i5 – 8GB" → "Dell Latitude 7420"
 */
function cleanProductName(name: string): string {
  return name
    // Replace special dashes with regular dash
    .replace(/–/g, '-')
    // Remove RAM specifications like "8GB", "16GB"
    .replace(/\s*-?\s*\d+GB\s*/gi, ' ')
    // Remove common suffixes that don't help search
    .replace(/\s+(Pro|Lite|Plus|Max|Ultra)\s*$/i, '')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Expands short codes into full brand/product names
 * Example: "i5-10600" → "Intel Core i5-10600"
 */
function expandBrandCodes(name: string): string {
  const expansions: Array<{ pattern: RegExp; replacement: string }> = [
    // Intel CPUs: "i5-10600" → "Intel Core i5-10600"
    { pattern: /^(i[357]-\d+)/i, replacement: 'Intel Core $1' },
    
    // AMD Ryzen CPUs: "R3-2200G" → "AMD Ryzen 3 2200G"
    { pattern: /^R([357])-?(\d+\w*)/i, replacement: 'AMD Ryzen $1 $2' },
    
    // NVIDIA GPUs: "GT 730" → "NVIDIA GeForce GT 730"
    { pattern: /^(GT|GTX|RTX)\s*(\d+)/i, replacement: 'NVIDIA GeForce $1 $2' },
    
    // AMD GPUs: "R5-230" → "AMD Radeon R5 230"
    { pattern: /^(R[579])-?(\d+)/i, replacement: 'AMD Radeon $1 $2' },
  ];

  for (const { pattern, replacement } of expansions) {
    if (pattern.test(name)) {
      return name.replace(pattern, replacement);
    }
  }

  return name;
}

/**
 * Gets the product type suffix based on category
 * This helps search engines find the right products
 * Example: category "Laptops" → suffix "laptop"
 */
function getCategorySuffix(category: string): string {
  const suffixMap: Record<string, string> = {
    // Computer Hardware
    'Laptops': 'laptop',
    'Monitors': 'monitor',
    'Printers': 'printer',
    
    // Components
    'Computer Parts': '',  // Parts are too varied, no suffix
    'Graphics Cards': 'graphics card',
    'Processors': 'processor',
    'Motherboards': 'motherboard',
    'Memory': 'RAM',
    'Storage': '',  // SSD/HDD already descriptive
    
    // Peripherals
    'Computer Accessories': '',  // Too varied
    'Keyboards': 'keyboard',
    'Mice': 'mouse',
    'Headsets': 'headset',
    'Speakers': 'speaker',
    'Webcams': 'webcam',
    
    // Networking
    'Networking': 'router',
    
    // Power & Cables
    'Power Supply': 'power supply',
    'Chargers': 'charger',
    'Cables': 'cable',
    
    // Cases
    'Cases': 'PC case',
    
    // Electronic Accessories
    'Electronic Accessories': '',
    'Audio': 'speaker',
    'Peripherals': '',
  };

  return suffixMap[category] || '';
}

/**
 * Detects product type from name when category doesn't help
 * Example: "HP KB5100" contains "KB" → "keyboard"
 */
function detectProductType(name: string): string {
  const typePatterns: Array<{ pattern: RegExp; type: string }> = [
    // Laptops - brand + model patterns
    { pattern: /\b(latitude|elitebook|thinkpad|ideapad|pavilion|inspiron)\b/i, type: 'laptop' },
    
    // Monitors - size patterns like 24", 27"
    { pattern: /\b\d{2}["']\s*(led|ips|lcd|monitor)/i, type: 'monitor' },
    { pattern: /\bmonitor\b/i, type: 'monitor' },
    
    // Printers
    { pattern: /\b(pixma|laserjet|inkjet|printer)\b/i, type: 'printer' },
    
    // Storage
    { pattern: /\b\d+\s*(gb|tb)\s*(ssd|hdd)\b/i, type: '' },  // Already descriptive
    { pattern: /\bexternal\b.*\b(hdd|hard\s*drive)\b/i, type: 'external hard drive' },
    { pattern: /\bflash\s*drive\b/i, type: 'USB flash drive' },
    
    // Power Supply
    { pattern: /\b\d+\s*w\s*(psu|power)/i, type: 'power supply' },
    { pattern: /\bpsu\b/i, type: 'power supply' },
    
    // Peripherals
    { pattern: /\bkb\d+|keyboard\b/i, type: 'keyboard' },
    { pattern: /\bmouse\b/i, type: 'mouse' },
    { pattern: /\bheadset|headphone\b/i, type: 'headset' },
    { pattern: /\bspeaker|spk\d+\b/i, type: 'speaker' },
    { pattern: /\bcamera|webcam\b/i, type: 'webcam' },
    
    // Networking
    { pattern: /\brouter|ew-\d+n\b/i, type: 'wireless router' },
    
    // Cables
    { pattern: /\bhdmi\b/i, type: 'cable' },
    { pattern: /\bvga\b.*\bhdmi\b/i, type: 'adapter cable' },
    
    // Chargers
    { pattern: /\b\d+w\s*\d+v\b/i, type: 'laptop charger' },
    { pattern: /\btype-c\b.*\bcharger\b/i, type: 'laptop charger' },
    
    // Motherboards
    { pattern: /\b(b\d+m?|x\d+|z\d+)\s*(msi|asus|gigabyte|board)?\b/i, type: 'motherboard' },
    { pattern: /\bboard\b/i, type: 'motherboard' },
    
    // RAM
    { pattern: /\b\d+gb\s*ram\b/i, type: 'DDR4 RAM' },
    
    // Cases
    { pattern: /\bcase\b/i, type: 'PC case' },
    { pattern: /\b(gundam|t\d+)\b/i, type: 'PC case' },
    
    // External enclosures
    { pattern: /\b2\.5["']?\s*(hdd|ssd)?\b/i, type: 'HDD enclosure' },
  ];

  for (const { pattern, type } of typePatterns) {
    if (pattern.test(name)) {
      return type;
    }
  }

  return '';
}

/**
 * MAIN FUNCTION: Generates a search-friendly term from product name and category
 * This is fully automatic - no need to add new products to any list!
 * 
 * How it works:
 * 1. Cleans up the product name (removes specs, normalizes dashes)
 * 2. Expands short codes (i5 → Intel Core i5)
 * 3. Adds product type suffix based on category or name detection
 * 
 * Examples:
 * - "Dell Latitude 7420 i5 – 8GB", "Laptops" → "Dell Latitude 7420 laptop"
 * - "GT 730", "Computer Parts" → "NVIDIA GeForce GT 730 graphics card"
 * - "HP KB5100", "Computer Accessories" → "HP KB5100 keyboard"
 */
function generateSearchTerm(productName: string, category: string): string {
  // Step 1: Clean the product name
  let searchTerm = cleanProductName(productName);
  
  // Step 2: Expand brand codes (Intel, AMD, NVIDIA, etc.)
  searchTerm = expandBrandCodes(searchTerm);
  
  // Step 3: Get suffix from category first, then try detection from name
  let suffix = getCategorySuffix(category);
  
  // If category doesn't give us a suffix, try to detect from name
  if (!suffix) {
    suffix = detectProductType(productName);
  }
  
  // Step 4: Add suffix if we have one and it's not already in the name
  if (suffix && !searchTerm.toLowerCase().includes(suffix.toLowerCase())) {
    searchTerm = `${searchTerm} ${suffix}`;
  }
  
  // Step 5: Final cleanup - convert inch symbols for URLs
  searchTerm = searchTerm.replace(/["']/g, ' inch ').replace(/\s+/g, ' ').trim();
  
  return searchTerm;
}

// ==========================================
// PRICE EXTRACTION
// ==========================================
// Finds prices in webpage content using pattern matching
// ==========================================

/**
 * Extracts the lowest valid price from text content
 * Looks for Philippine Peso formats: ₱1,234.00, PHP 1,234, P1234
 */
function extractPrice(text: string): number | null {
  // Different price formats used by Philippine websites
  const pricePatterns = [
    /₱\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)/g,      // ₱1,234.00
    /PHP\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)/gi,   // PHP 1,234.00
    /(\d{1,3}(?:,\d{3})+)\.00/g,                   // 1,234.00
    /P\s*(\d{4,}(?:,\d{3})*(?:\.\d{2})?)/g,       // P1234
  ];

  const prices: number[] = [];

  // Try each pattern and collect all valid prices
  for (const pattern of pricePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const priceStr = match[1].replace(/,/g, '');  // Remove commas
      const price = parseFloat(priceStr);
      
      // Only accept reasonable prices (₱500 to ₱200,000)
      if (price >= 500 && price <= 200000) {
        prices.push(price);
      }
    }
  }

  // Return the lowest price found (usually the actual product price)
  if (prices.length === 0) {
    return null;
  }

  return Math.min(...prices);
}

// ==========================================
// COMPETITOR SCRAPING
// ==========================================
// Functions to scrape each competitor website
// ==========================================

/**
 * Scrapes a single competitor website for a product price
 */
async function scrapeCompetitor(
  competitor: string,
  productName: string,
  searchTerm: string,
  apiKey: string
): Promise<{ price: number | null; source: string; error?: string }> {
  // Build the search URL for each competitor
  let url: string;
  
  switch (competitor) {
    case 'Octagon':
      url = `https://octagon.com.ph/catalogsearch/result/?q=${encodeURIComponent(searchTerm)}`;
      break;
    case 'Villman':
      url = `https://villman.com/search?q=${encodeURIComponent(searchTerm)}`;
      break;
    case 'PC Express':
      url = `https://pcx.com.ph/search?q=${encodeURIComponent(searchTerm)}`;
      break;
    default:
      return { price: null, source: '', error: 'Unknown competitor' };
  }

  try {
    console.log(`[${competitor}] Searching: ${searchTerm}`);
    
    // Call Firecrawl API to scrape the page
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],  // Get page as markdown text
        onlyMainContent: true,  // Skip headers/footers
        waitFor: 2000,          // Wait 2s for JavaScript to load
      }),
    });

    const data = await response.json();
    
    // Handle errors from Firecrawl
    if (!response.ok || !data.success) {
      if (response.status === 429 || (data.error && data.error.includes('rate'))) {
        console.warn(`[${competitor}] Rate limited, skipping`);
        return { price: null, source: url, error: 'Rate limited' };
      }
      console.error(`[${competitor}] API error:`, data);
      return { price: null, source: url, error: data.error || 'Failed to scrape' };
    }

    // Extract price from the markdown content
    const markdown = data.data?.markdown || data.markdown || '';
    const price = extractPrice(markdown);
    
    console.log(`[${competitor}] Found price: ${price} for ${productName}`);
    return { price, source: url };
  } catch (error) {
    console.error(`[${competitor}] Error:`, error);
    return { price: null, source: url, error: String(error) };
  }
}

// ==========================================
// BATCH PROCESSING
// ==========================================
// Process multiple products efficiently
// ==========================================

/**
 * Process a batch of products in parallel
 * For each product, scrapes all competitors at the same time
 */
async function processBatch(
  batch: ProductToScrape[],
  competitors: string[],
  apiKey: string
): Promise<ScrapedPrice[]> {
  const results: ScrapedPrice[] = [];
  
  // Process each product in the batch
  const productPromises = batch.map(async (product) => {
    // Generate search term automatically (or use custom if provided)
    const searchTerm = product.searchTerm || generateSearchTerm(product.name, product.category);
    
    // Scrape all competitors for this product at the same time
    const competitorPromises = competitors.map(async (competitor) => {
      const result = await scrapeCompetitor(competitor, product.name, searchTerm, apiKey);
      return {
        productId: product.id,
        productName: product.name,
        competitor,
        price: result.price,
        source: result.source,
        error: result.error,
      };
    });
    
    return Promise.all(competitorPromises);
  });
  
  // Wait for all products to finish
  const batchResults = await Promise.all(productPromises);
  for (const productResults of batchResults) {
    results.push(...productResults);
  }
  
  return results;
}

// ==========================================
// MAIN REQUEST HANDLER
// ==========================================
// Entry point for the edge function
// ==========================================

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const { products, competitors, scanMode } = await req.json() as {
      products: ProductToScrape[];
      competitors?: string[];
      scanMode?: 'quick' | 'full';
    };

    // Validate input
    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Products array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for API key
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured. Please connect it in Settings → Connectors.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default to all competitors if not specified
    const selectedCompetitors = competitors || ['Octagon', 'Villman', 'PC Express'];
    const results: ScrapedPrice[] = [];
    
    // ==========================================
    // RATE LIMITING SETTINGS
    // ==========================================
    // Process 2 products at a time (6 API calls per batch)
    // Wait 8 seconds between batches to stay under rate limit
    const BATCH_SIZE = 2;
    const DELAY_BETWEEN_BATCHES = 8000;

    console.log(`Starting scrape for ${products.length} products across ${selectedCompetitors.length} competitors`);
    console.log(`Processing in batches of ${BATCH_SIZE} products`);

    // Process products in batches
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(products.length / BATCH_SIZE);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches}`);
      
      const batchResults = await processBatch(batch, selectedCompetitors, apiKey);
      results.push(...batchResults);
      
      // Wait between batches (except for the last one)
      if (i + BATCH_SIZE < products.length) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // Count results
    const successful = results.filter(r => r.price !== null).length;
    const failed = results.filter(r => r.price === null).length;

    console.log(`Scraping complete: ${successful} found, ${failed} not found`);

    // Return results
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
