import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Database, Loader2, CheckCircle, TestTube } from "lucide-react";
import { Card, CardContent } from "./ui/card";

interface SupabaseIntegrationProps {
  projectId: string;
}

const SupabaseIntegration = ({ projectId }: SupabaseIntegrationProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [supabaseServiceKey, setSupabaseServiceKey] = useState("");

  useEffect(() => {
    loadIntegration();
  }, [projectId]);

  const loadIntegration = async () => {
    try {
      const { data, error } = await supabase
        .from("project_integrations")
        .select("*")
        .eq("project_id", projectId)
        .eq("integration_type", "supabase")
        .maybeSingle();

      if (error) throw error;
      setIntegration(data);

      if (data?.config) {
        setSupabaseUrl(data.config.url || "");
      }
      if (data?.credentials) {
        setSupabaseAnonKey(data.credentials.anon_key || "");
        setSupabaseServiceKey(data.credentials.service_key || "");
      }
    } catch (error: any) {
      console.error("Error loading integration:", error);
    }
  };

  const testConnection = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      toast({
        title: "Missing credentials",
        description: "Please enter Supabase URL and Anon Key",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const testResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      });

      if (!testResponse.ok) {
        throw new Error("Connection test failed");
      }

      toast({
        title: "Connection successful",
        description: "Successfully connected to Supabase project",
      });
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      toast({
        title: "Missing credentials",
        description: "Please enter Supabase URL and Anon Key",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const integrationData = {
        project_id: projectId,
        integration_type: "supabase",
        config: {
          url: supabaseUrl,
        },
        credentials: {
          anon_key: supabaseAnonKey,
          service_key: supabaseServiceKey || null,
        },
        status: "connected",
        last_sync_at: new Date().toISOString(),
      };

      if (integration) {
        const { error } = await supabase
          .from("project_integrations")
          .update(integrationData)
          .eq("id", integration.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_integrations")
          .insert(integrationData);

        if (error) throw error;
      }

      toast({
        title: "Supabase connected",
        description: "Successfully connected to Supabase project",
      });

      await loadIntegration();
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration) return;

    try {
      const { error } = await supabase
        .from("project_integrations")
        .delete()
        .eq("id", integration.id);

      if (error) throw error;

      setIntegration(null);
      setSupabaseUrl("");
      setSupabaseAnonKey("");
      setSupabaseServiceKey("");

      toast({
        title: "Disconnected",
        description: "Supabase integration removed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {integration?.status === "connected" ? (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Connected to Supabase
                  </p>
                  {integration.config?.url && (
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {integration.config.url}
                    </p>
                  )}
                  {integration.last_sync_at && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Connected: {new Date(integration.last_sync_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supabase-url">Supabase Project URL</Label>
            <Input
              id="supabase-url"
              type="url"
              placeholder="https://xxxxxxxxxxxxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Find this in your Supabase project settings under API
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabase-anon">Anon/Public Key</Label>
            <Input
              id="supabase-anon"
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This key is safe to use in a browser
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabase-service">
              Service Role Key <span className="text-xs text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="supabase-service"
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseServiceKey}
              onChange={(e) => setSupabaseServiceKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Only needed for admin operations. Keep this secret!
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={testConnection}
              disabled={testing || !supabaseUrl || !supabaseAnonKey}
              variant="outline"
              className="flex-1"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              onClick={handleConnect}
              disabled={loading || !supabaseUrl || !supabaseAnonKey}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Connect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupabaseIntegration;
