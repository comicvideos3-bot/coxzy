import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Github, Loader2, CheckCircle, XCircle, RefreshCw, Upload, Download } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";

interface GitHubIntegrationProps {
  projectId: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
}

const GitHubIntegration = ({ projectId }: GitHubIntegrationProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [branch, setBranch] = useState("main");
  const [githubToken, setGithubToken] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadIntegration();
  }, [projectId]);

  const loadIntegration = async () => {
    try {
      const { data, error } = await supabase
        .from("project_integrations")
        .select("*")
        .eq("project_id", projectId)
        .eq("integration_type", "github")
        .maybeSingle();

      if (error) throw error;
      setIntegration(data);

      if (data?.credentials?.token) {
        setGithubToken(data.credentials.token);
        await loadRepos(data.credentials.token);
      }
    } catch (error: any) {
      console.error("Error loading integration:", error);
    }
  };

  const loadRepos = async (token: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-oauth?action=repos`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "X-GitHub-Token": token,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load repositories");
      }

      const data = await response.json();
      setRepos(data.repos || []);
    } catch (error: any) {
      toast({
        title: "Error loading repositories",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleConnect = async () => {
    if (!githubToken) {
      toast({
        title: "Missing token",
        description: "Please enter your GitHub personal access token",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await loadRepos(githubToken);

      const repoData = selectedRepo ? JSON.parse(selectedRepo) : null;

      const integrationData = {
        project_id: projectId,
        integration_type: "github",
        config: repoData
          ? {
              repo_owner: repoData.full_name.split("/")[0],
              repo_name: repoData.name,
              branch: branch || "main",
            }
          : {},
        credentials: {
          token: githubToken,
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
        title: "GitHub connected",
        description: "Successfully connected to GitHub",
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
      setRepos([]);
      setSelectedRepo("");
      setGithubToken("");

      toast({
        title: "Disconnected",
        description: "GitHub integration removed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSync = async (action: "push" | "pull") => {
    if (!integration?.config) {
      toast({
        title: "Not configured",
        description: "Please select a repository first",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { data: files } = await supabase
        .from("files")
        .select("*")
        .eq("project_id", projectId);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            projectId,
            githubToken: integration.credentials.token,
            repoOwner: integration.config.repo_owner,
            repoName: integration.config.repo_name,
            branch: integration.config.branch,
            commitMessage: `Update from AI Dev Workspace`,
            files: files?.map((f) => ({
              path: f.path,
              content: f.content,
            })),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }

      const result = await response.json();

      toast({
        title: `${action === "push" ? "Pushed" : "Pulled"} successfully`,
        description:
          action === "push"
            ? `Committed: ${result.commit}`
            : `Updated ${result.filesUpdated} files`,
      });

      await supabase
        .from("project_integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", integration.id);

      await loadIntegration();
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
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
                    Connected to GitHub
                  </p>
                  {integration.config?.repo_name && (
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {integration.config.repo_owner}/{integration.config.repo_name}
                      <Badge variant="outline" className="ml-2">
                        {integration.config.branch}
                      </Badge>
                    </p>
                  )}
                  {integration.last_sync_at && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => handleSync("push")}
                disabled={syncing}
                className="flex-1"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Push to GitHub
              </Button>
              <Button
                onClick={() => handleSync("pull")}
                disabled={syncing}
                variant="outline"
                className="flex-1"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Pull from GitHub
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="github-token">GitHub Personal Access Token</Label>
            <Input
              id="github-token"
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Create a token at{" "}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                github.com/settings/tokens
              </a>{" "}
              with repo access
            </p>
          </div>

          {repos.length > 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="repo-select">Select Repository</Label>
                <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                  <SelectTrigger id="repo-select">
                    <SelectValue placeholder="Choose a repository" />
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map((repo) => (
                      <SelectItem key={repo.id} value={JSON.stringify(repo)}>
                        {repo.full_name}
                        {repo.private && (
                          <Badge variant="secondary" className="ml-2">
                            Private
                          </Badge>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
            </>
          )}

          <Button onClick={handleConnect} disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Github className="h-4 w-4 mr-2" />
            )}
            {repos.length > 0 ? "Connect Repository" : "Load Repositories"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default GitHubIntegration;
