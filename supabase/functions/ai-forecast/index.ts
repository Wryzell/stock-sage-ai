import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('AI Forecast function started');
    
    const { productId, algorithm = 'exponential_smoothing', forecastDays = 30 } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching sales data...');

    // Fetch sales data for analysis
    let salesQuery = supabase
      .from('sales')
      .select('*, products(name, category, current_stock, min_stock)')
      .order('sale_date', { ascending: false })
      .limit(100);

    if (productId) {
      salesQuery = salesQuery.eq('product_id', productId);
    }

    const { data: salesData, error: salesError } = await salesQuery;
    
    if (salesError) {
      console.error('Error fetching sales:', salesError);
      throw new Error('Failed to fetch sales data');
    }

    console.log(`Fetched ${salesData?.length || 0} sales records`);

    // Fetch products for stock analysis
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('current_stock', { ascending: true });

    if (productsError) {
      console.error('Error fetching products:', productsError);
      throw new Error('Failed to fetch products data');
    }

    console.log(`Fetched ${products?.length || 0} products`);

    // Prepare context for AI
    const salesSummary = salesData?.map(s => ({
      product: s.products?.name,
      category: s.products?.category,
      quantity: s.quantity,
      total: s.total,
      date: s.sale_date,
      currentStock: s.products?.current_stock,
      minStock: s.products?.min_stock,
    })) || [];

    const productSummary = products?.map(p => ({
      name: p.name,
      category: p.category,
      currentStock: p.current_stock,
      minStock: p.min_stock,
    })) || [];

    const systemPrompt = `You are an AI inventory demand forecasting specialist. Analyze the provided sales data and inventory levels to generate accurate demand predictions.

Your task:
1. Analyze historical sales patterns
2. Identify products at risk of stockout
3. Calculate predicted demand for the next ${forecastDays} days
4. Provide confidence levels (0-100%) for each prediction
5. Generate actionable recommendations

Algorithm preference: ${algorithm}

Respond ONLY with valid JSON in this exact format:
{
  "forecasts": [
    {
      "productName": "string",
      "predictedDemand": number,
      "confidenceLevel": number,
      "trend": "increasing" | "stable" | "decreasing",
      "recommendation": "string",
      "stockoutRisk": "low" | "medium" | "high",
      "suggestedReorderQty": number
    }
  ],
  "insights": [
    {
      "type": "warning" | "opportunity" | "info",
      "title": "string",
      "description": "string"
    }
  ],
  "summary": "string"
}`;

    const userPrompt = `Analyze this inventory data and generate demand forecasts:

RECENT SALES (last 100 transactions):
${JSON.stringify(salesSummary, null, 2)}

CURRENT INVENTORY LEVELS:
${JSON.stringify(productSummary, null, 2)}

Generate forecasts for the next ${forecastDays} days.`;

    console.log('Calling Lovable AI gateway...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI service error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    console.log('AI response received, length:', content?.length);

    // Parse the AI response
    let forecastData;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                       content.match(/```\n?([\s\S]*?)\n?```/) ||
                       [null, content];
      const jsonStr = jsonMatch[1] || content;
      forecastData = JSON.parse(jsonStr.trim());
      console.log('Successfully parsed forecast data');
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw content:', content?.substring(0, 500));
      
      // Return a fallback response
      forecastData = {
        forecasts: [],
        insights: [{
          type: 'info',
          title: 'Analysis Complete',
          description: 'AI analysis completed but structured data parsing failed. Please try again.'
        }],
        summary: content || 'Forecast analysis could not be completed.'
      };
    }

    return new Response(JSON.stringify(forecastData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in ai-forecast function:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate forecast';
    return new Response(JSON.stringify({ 
      error: message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});