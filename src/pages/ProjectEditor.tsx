import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code2, MessageSquare, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import AIChat, { FileAction } from "@/components/AIChat";
import CodePreview from "@/components/CodePreview";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Project {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
}

interface FileItem {
  id: string;
  path: string;
  content: string | null;
  language: string;
  created_at: string;
  updated_at: string;
}

const ProjectEditor = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"chat" | "code">("chat");

  useEffect(() => {
    if (!projectId) {
      toast({
        title: "Invalid project",
        description: "Project ID is missing",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
    
    loadProject();
    loadFiles();

    // Subscribe to file changes
    const channel = supabase
      .channel(`files-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "files",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          loadFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, navigate]);

  const loadProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      if (!data) {
        toast({
          title: "Project not found",
          description: "The requested project does not exist",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      
      setProject(data);
    } catch (error: any) {
      toast({
        title: "Error loading project",
        description: error.message,
        variant: "destructive",
      });
      navigate("/");
    }
  };

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("project_id", projectId)
        .order("path", { ascending: true });

      if (error) throw error;
      setFiles(data || []);
      
      // If no file selected but files exist, select the first one
      if (!selectedFile && data && data.length > 0) {
        setSelectedFile(data[0]);
      }
    } catch (error: any) {
      toast({
        title: "Error loading files",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileAction = async (action: FileAction) => {
    try {
      if (action.type === "create") {
        // Check if file already exists
        const existingFile = files.find(f => f.path === action.path);
        
        if (existingFile) {
          // Update existing file
          const { error } = await supabase
            .from("files")
            .update({ content: action.content, language: action.language })
            .eq("id", existingFile.id);

          if (error) throw error;
          
          setSelectedFile({ ...existingFile, content: action.content, language: action.language });
        } else {
          // Create new file
          const { data, error } = await supabase
            .from("files")
            .insert({
              project_id: projectId,
              path: action.path,
              language: action.language,
              content: action.content,
            })
            .select()
            .single();

          if (error) throw error;
          setSelectedFile(data);
        }
      } else if (action.type === "edit" && selectedFile) {
        const { error } = await supabase
          .from("files")
          .update({ content: action.content })
          .eq("id", selectedFile.id);

        if (error) throw error;
        setSelectedFile({ ...selectedFile, content: action.content });
      }
      
      await loadFiles();
    } catch (error: any) {
      toast({
        title: "Error updating file",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;

    try {
      const { error } = await supabase
        .from("files")
        .update({ content: selectedFile.content })
        .eq("id", selectedFile.id);

      if (error) throw error;

      toast({
        title: "File saved",
        description: `Saved ${selectedFile.path}`,
      });
    } catch (error: any) {
      toast({
        title: "Error saving file",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading project...</p>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-muted-foreground">{project.description}</p>
              )}
            </div>
          </div>

          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "chat" | "code")}>
            <TabsList>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                AI Chat
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                Code Editor
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 h-full">
          {/* Left Panel - Chat or Code Editor */}
          <div className="border-r flex flex-col h-full">
            {activeView === "chat" ? (
              <AIChat projectId={projectId!} onFileAction={handleFileAction} />
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {selectedFile?.path || "No file selected"}
                    </h3>
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground">
                        {selectedFile.language}
                      </p>
                    )}
                  </div>
                  {selectedFile && (
                    <Button onClick={handleSaveFile} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  {selectedFile ? (
                    <Textarea
                      value={selectedFile.content || ""}
                      onChange={(e) =>
                        setSelectedFile({ ...selectedFile, content: e.target.value })
                      }
                      placeholder="Start typing..."
                      className="min-h-full font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Code2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a file from the preview panel to edit</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="flex flex-col h-full">
            <CodePreview
              files={files}
              selectedFile={selectedFile}
              onFileSelect={(file) => setSelectedFile(file)}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProjectEditor;
