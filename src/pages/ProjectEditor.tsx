import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, FileCode, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

const LANGUAGES = [
  { value: "plaintext", label: "Plain Text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" },
];

const ProjectEditor = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New file form state
  const [newFilePath, setNewFilePath] = useState("");
  const [newFileLanguage, setNewFileLanguage] = useState("plaintext");
  const [showNewFileForm, setShowNewFileForm] = useState(false);

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

  const handleCreateFile = async () => {
    if (!newFilePath.trim()) {
      toast({
        title: "Invalid file path",
        description: "Please enter a file path",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("files")
        .insert({
          project_id: projectId,
          path: newFilePath,
          language: newFileLanguage,
          content: "",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "File created",
        description: `Created ${newFilePath}`,
      });

      setNewFilePath("");
      setNewFileLanguage("plaintext");
      setShowNewFileForm(false);
      setSelectedFile(data);
    } catch (error: any) {
      toast({
        title: "Error creating file",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("files")
        .update({
          content: selectedFile.content,
          language: selectedFile.language,
        })
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
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from("files")
        .delete()
        .eq("id", fileId);

      if (error) throw error;

      toast({
        title: "File deleted",
        description: "File has been removed",
      });

      if (selectedFile?.id === fileId) {
        setSelectedFile(null);
      }
    } catch (error: any) {
      toast({
        title: "Error deleting file",
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* File Explorer */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Files</CardTitle>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowNewFileForm(!showNewFileForm)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {showNewFileForm && (
                <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                  <div>
                    <Label htmlFor="filePath">File Path</Label>
                    <Input
                      id="filePath"
                      placeholder="src/example.ts"
                      value={newFilePath}
                      onChange={(e) => setNewFilePath(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Select value={newFileLanguage} onValueChange={setNewFileLanguage}>
                      <SelectTrigger id="language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreateFile} className="flex-1">
                      Create
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowNewFileForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No files yet. Create one to get started.
                </p>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedFile?.id === file.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileCode className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm truncate">{file.path}</span>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete file?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{file.path}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteFile(file.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Code Editor */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {selectedFile ? selectedFile.path : "No file selected"}
                  </CardTitle>
                  {selectedFile && (
                    <CardDescription>
                      Last updated: {new Date(selectedFile.updated_at).toLocaleString()}
                    </CardDescription>
                  )}
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedFile.language}
                      onValueChange={(value) =>
                        setSelectedFile({ ...selectedFile, language: value })
                      }
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleSaveFile} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedFile ? (
                <Textarea
                  value={selectedFile.content || ""}
                  onChange={(e) =>
                    setSelectedFile({ ...selectedFile, content: e.target.value })
                  }
                  placeholder="Start typing..."
                  className="min-h-[500px] font-mono text-sm"
                />
              ) : (
                <div className="flex items-center justify-center min-h-[500px] text-muted-foreground">
                  Select a file to edit or create a new one
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ProjectEditor;
