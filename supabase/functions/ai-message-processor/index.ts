import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=" + GEMINI_API_KEY;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: pendingMessages, error: fetchError } = await supabase
      .from("message")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch messages: ${fetchError.message}`);
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending messages", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processed = [];

    for (const msg of pendingMessages) {
      try {
        const payload = {
          contents: [{ role: "user", parts: [{ text: msg.message_text }] }],
          generationConfig: { temperature: 0.7 },
        };

        const response = await fetch(GEMINI_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.status}`);
        }

        const result = await response.json();
        const aiReply = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiReply) {
          throw new Error("Empty AI response");
        }

        const { error: insertError } = await supabase.from("message").insert([{
          sender: "ai",
          message_text: aiReply,
          status: "answered",
        }]);

        if (insertError) throw insertError;

        const { error: updateError } = await supabase
          .from("message")
          .update({ status: "answered" })
          .eq("id", msg.id);

        if (updateError) throw updateError;

        processed.push(msg.id);
      } catch (err) {
        console.error(`Failed to process message ${msg.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ message: "Processing complete", processed: processed.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});