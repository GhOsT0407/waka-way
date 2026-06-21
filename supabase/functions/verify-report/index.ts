import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIAnalysis {
  is_valid: boolean;
  category: 'real' | 'spam' | 'unclear';
  confidence: number;
  sentiment: 'urgent' | 'neutral' | 'low';
  reason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { contribution_id } = await req.json();
    if (!contribution_id) {
      return new Response(
        JSON.stringify({ error: 'contribution_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: contribution, error: fetchError } = await supabase
      .from('contributions')
      .select('*')
      .eq('id', contribution_id)
      .single();

    if (fetchError || !contribution) {
      return new Response(
        JSON.stringify({ error: 'Contribution not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    let analysis: AIAnalysis;

    if (geminiApiKey) {
      // Call Gemini for AI scoring
      const prompt = `You are a Nigerian traffic and safety report verifier for a transit app called WakaWay.

Analyze this user report and determine if it's legitimate:
Type: ${contribution.type}
Title: ${contribution.title}
Description: ${contribution.description || 'No description'}
Location: Lat ${contribution.latitude}, Lng ${contribution.longitude}

Consider:
1. Does the description match the report type?
2. Is it a genuine safety/transit concern (go-slow, flooding, robbery, road damage)?
3. Could it be spam or a test?

Respond with JSON only (no markdown):
{"is_valid":true/false,"category":"real"|"spam"|"unclear","confidence":0.0-1.0,"sentiment":"urgent"|"neutral"|"low","reason":"1-2 sentences"}`;

      try {
        const gemRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
            }),
          }
        );
        const gemData = await gemRes.json();
        const raw = gemData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        analysis = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
      } catch {
        // Gemini failed — fall back to rule-based
        analysis = ruleBasedScore(contribution);
      }
    } else {
      // No Gemini key — use rule-based scoring
      analysis = ruleBasedScore(contribution);
    }

    // Determine new status
    let newStatus: string = contribution.status;
    if (analysis.category === 'real' && analysis.confidence >= 0.75) {
      newStatus = analysis.sentiment === 'urgent' ? 'high-priority' : 'approved';
    } else if (analysis.category === 'spam' && analysis.confidence >= 0.85) {
      newStatus = 'rejected';
    }

    await supabase
      .from('contributions')
      .update({
        ai_score:     analysis.confidence,
        ai_category:  analysis.category,
        ai_sentiment: analysis.sentiment,
        status:       newStatus,
      })
      .eq('id', contribution_id);

    return new Response(
      JSON.stringify({ success: true, contribution_id, analysis, new_status: newStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Rule-based scoring when Gemini key is not set
function ruleBasedScore(contribution: Record<string, unknown>): AIAnalysis {
  const type = String(contribution.type ?? '');
  const title = String(contribution.title ?? '').toLowerCase();
  const desc  = String(contribution.description ?? '').toLowerCase();
  const text  = title + ' ' + desc;

  // Spam signals
  const spamWords = ['test', 'testing', 'asdf', 'hello', 'hi ', 'dummy', 'fake', 'lol'];
  const isSpam = spamWords.some(w => text.includes(w)) && text.length < 30;
  if (isSpam) {
    return { is_valid: false, category: 'spam', confidence: 0.82, sentiment: 'low', reason: 'Appears to be a test or spam submission.' };
  }

  // Urgency signals (Nigerian context)
  const urgentWords = ['robbery', 'attack', 'armed', 'shooting', 'flood', 'accident', 'crash', 'fire', 'one-chance', 'danger'];
  const isUrgent = urgentWords.some(w => text.includes(w)) || type === 'security' || type === 'danger_zone';
  const hasDesc  = desc.length > 10;

  return {
    is_valid:   true,
    category:   hasDesc ? 'real' : 'unclear',
    confidence: hasDesc ? (isUrgent ? 0.85 : 0.72) : 0.50,
    sentiment:  isUrgent ? 'urgent' : type === 'traffic' || type === 'construction' ? 'neutral' : 'neutral',
    reason:     hasDesc
      ? `Appears to be a legitimate ${type} report for Lagos.`
      : 'Short description — needs more detail to verify.',
  };
}
