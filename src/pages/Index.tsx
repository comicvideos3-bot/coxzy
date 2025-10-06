import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import TypingIndicator from "@/components/TypingIndicator";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load existing messages on mount
  useEffect(() => {
    loadMessages();
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('realtime:message')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message' },
        (payload) => {
          const newMsg = payload.new as any;
          setMessages((prev) => [
            ...prev,
            {
              id: newMsg.id,
              role: newMsg.sender === 'user' ? 'user' : 'assistant',
              content: newMsg.message_text,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('message')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Load error:', error);
      return;
    }

    if (data) {
      setMessages(
        data.map((m) => ({
          id: m.id,
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.message_text,
        }))
      );
    }
  };

  const handleSendMessage = async (content: string) => {
    setIsLoading(true);

    try {
      // Insert user message
      const { data: insertedMsg, error: insertError } = await supabase
        .from('message')
        .insert({
          sender: 'user',
          message_text: content,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Call edge function to generate AI response
      const { error: functionError } = await supabase.functions.invoke('ai-responder', {
        body: { messageId: insertedMsg.id },
      });

      if (functionError) {
        console.error('Function error:', functionError);
        toast({
          title: "Error",
          description: "Failed to get AI response. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container max-w-4xl mx-auto px-4 py-8 flex flex-col h-screen">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              DeepSeek Chat
            </h1>
          </div>
          <p className="text-muted-foreground">Powered by Gemini 2.5 Flash</p>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto mb-6 space-y-4 pr-2">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground mt-20 animate-fade-in">
              <p className="text-lg">Start a conversation with AI</p>
              <p className="text-sm mt-2">Ask me anything!</p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <ChatMessage key={index} role={message.role} content={message.content} />
          ))}
          
          {isLoading && <TypingIndicator />}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-lg">
          <ChatInput onSend={handleSendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  );
};

export default Index;
