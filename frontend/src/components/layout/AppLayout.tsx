import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-background overflow-hidden border-0">
        {user && <AppSidebar />}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header - Only show if user is authenticated */}
          {user && (
            <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0 z-40">
              <div className="flex items-center justify-between h-full px-4">
                <div className="flex items-center gap-4">
                  <SidebarTrigger />
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search..."
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </div>
            </header>
          )}

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className={`h-full ${!user ? 'w-full' : ''}`}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}