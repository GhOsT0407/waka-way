import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerifyReportRequest {
  contribution_id: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface AIAnalysis {
  is_valid: boolean;
  category: 'real' | 'spam' | 'unclear';
  confidence: number;
  sentiment: 'urgent' | 'neutral' | 'low';
  reason: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { contribution_id } = await req.json() as VerifyReportRequest;

    if (!contribution_id) {
      return new Response(
        JSON.stringify({ error: 'contribution_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
    // injected automatically into every edge function's environment)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the contribution
    const { data: contribution, error: fetchError } = await supabase
      .from('contributions')
      .select('*')
      .eq('id', contribution_id)
      .single();

    if (fetchError || !contribution) {
      return new Response(
        JSON.stringify({ error: 'Contribution not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Gemini AI for verification
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not set');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const prompt = `You are a Nigerian traffic and safety report verifier for a transit app called WakaWay.

Analyze this user report and determine if it's legitimate:

Type: ${contribution.type}
Title: ${contribution.title}
Description: ${contribution.description || 'No description'}
Location: Lat ${contribution.latitude}, Lng ${contribution.longitude}
Address: ${contribution.address || 'Unknown'}

Consider these factors:
1. Does the description match the report type?
2. Is the language appropriate and non-offensive?
3. Does it seem like a genuine safety/transit concern?
4. Could this be spam, a joke, or misinformation?
5. For Nigerian context: common issues include "go-slow" (traffic), "one-chance" (robbery), flooding, road repairs, etc.

Respond with a JSON object only (no markdown):
{
  "is_valid": true/false,
  "category": "real" | "spam" | "unclear",
  "confidence": 0.0-1.0,
  "sentiment": "urgent" | "neutral" | "low",
  "reason": "Brief explanation in 1-2 sentences"
}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    const geminiData = await geminiResponse.json() as GeminiResponse;
    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse AI response
    let analysis: AIAnalysis;
    try {
      // Remove any markdown formatting if present
      const cleanJson = aiText.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiText);
      analysis = {
        is_valid: true, // Default to valid if AI fails
        category: 'unclear',
        confidence: 0.5,
        sentiment: 'neutral',
        reason: 'AI analysis failed, defaulting to pending review',
      };
    }

    // Determine new status based on AI analysis
    let newStatus = contribution.status;
    if (analysis.is_valid && analysis.category === 'real') {
      if (analysis.sentiment === 'urgent' && analysis.confidence > 0.8) {
        newStatus = 'high-priority';
      } else if (analysis.confidence > 0.7) {
        newStatus = 'approved';
      }
    } else if (analysis.category === 'spam' && analysis.confidence > 0.8) {
      newStatus = 'rejected';
    }
    // Otherwise keep as 'pending' for manual review

    // Update the contribution with AI analysis
    const { error: updateError } = await supabase
      .from('contributions')
      .update({
        ai_score: analysis.confidence,
        ai_category: analysis.category,
        ai_sentiment: analysis.sentiment,
        status: newStatus,
      })
      .eq('id', contribution_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update contribution' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return the analysis result
    return new Response(
      JSON.stringify({
        success: true,
        contribution_id,
        analysis,
        new_status: newStatus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
