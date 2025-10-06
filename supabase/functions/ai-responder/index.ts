import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the message ID from the request
    const { messageId } = await req.json();

    // Fetch all messages to build context
    const { data: messages, error: fetchError } = await supabase
      .from('message')
      .select('*')
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    // Build conversation history
    const conversationHistory = messages
      .filter(m => m.id !== messageId) // Exclude the current pending message
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.message_text
      }));

    // Get the current user message
    const currentMessage = messages.find(m => m.id === messageId);
    if (!currentMessage) throw new Error('Message not found');

    conversationHistory.push({
      role: 'user',
      content: currentMessage.message_text
    });

    // Call Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant. Keep your answers clear, concise, and friendly.' },
          ...conversationHistory
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('Failed to get AI response');
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices[0].message.content;

    // Save AI response to database
    const { error: insertError } = await supabase
      .from('message')
      .insert({
        sender: 'ai',
        message_text: assistantMessage,
        status: 'completed'
      });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-responder:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
