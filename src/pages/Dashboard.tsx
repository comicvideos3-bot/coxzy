import ProjectList from "@/components/ProjectList";
import CreateProjectDialog from "@/components/CreateProjectDialog";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            AI Dev Workspace
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Your Projects</h2>
            <p className="text-muted-foreground">
              Create and manage your AI-powered development projects
            </p>
          </div>
          <CreateProjectDialog />
        </div>

        <ProjectList userId="anonymous" />
      </main>
    </div>
  );
};

export default Dashboard;