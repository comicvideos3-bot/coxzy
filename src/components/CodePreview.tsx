import { useEffect, useState } from "react";
import { Eye, Code, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ScrollArea } from "./ui/scroll-area";

interface FileItem {
  id: string;
  path: string;
  content: string | null;
  language: string;
  created_at: string;
  updated_at: string;
}

interface CodePreviewProps {
  files: FileItem[];
  selectedFile: FileItem | null;
  onFileSelect: (file: FileItem) => void;
}

const CodePreview = ({ files, selectedFile, onFileSelect }: CodePreviewProps) => {
  const [previewHtml, setPreviewHtml] = useState("");
  const [activeTab, setActiveTab] = useState("preview");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    generatePreview();
  }, [files]);

  const generatePreview = () => {
    // Find HTML file
    const htmlFile = files.find(f => 
      f.path.endsWith('.html') || f.language === 'html'
    );
    
    // Find CSS files
    const cssFiles = files.filter(f => 
      f.path.endsWith('.css') || f.language === 'css'
    );
    
    // Find JS files
    const jsFiles = files.filter(f => 
      f.path.endsWith('.js') || f.language === 'javascript'
    );

    let html = htmlFile?.content || `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Preview</title>
      </head>
      <body>
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui; color: #666;">
          <div style="text-align: center;">
            <h1 style="font-size: 2rem; margin-bottom: 1rem;">No HTML file found</h1>
            <p>Create an index.html file to see the preview</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Inject CSS
    if (cssFiles.length > 0) {
      const cssContent = cssFiles.map(f => f.content).join('\n');
      html = html.replace('</head>', `<style>${cssContent}</style></head>`);
    }

    // Inject JS
    if (jsFiles.length > 0) {
      const jsContent = jsFiles.map(f => f.content).join('\n');
      html = html.replace('</body>', `<script>${jsContent}</script></body>`);
    }

    setPreviewHtml(html);
  };

  const handleRefresh = () => {
    generatePreview();
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Files
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {activeTab === "preview" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="ml-2"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Tabs value={activeTab} className="flex-1 flex flex-col">
        <TabsContent value="preview" className="flex-1 m-0 p-0">
          <iframe
            key={refreshKey}
            srcDoc={previewHtml}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            title="Preview"
          />
        </TabsContent>

        <TabsContent value="files" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {files.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No files yet</p>
                </div>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedFile?.id === file.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => onFileSelect(file)}
                  >
                    <div className="font-mono text-sm font-semibold mb-1">
                      {file.path}
                    </div>
                    <div className="text-xs opacity-70">
                      {file.language} • {file.content?.length || 0} characters
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CodePreview;
