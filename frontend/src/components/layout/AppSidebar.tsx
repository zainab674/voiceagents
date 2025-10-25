import { 
  Home, 
  Phone, 
  Database, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  Users, 
  Building,
  Mail,
  Calendar,
  FileText,
  Shield,
  Network,
  MessageCircle,
  Megaphone,
  UserCheck,
  Brain,
  Bot
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "All Agents", url: "/all-agents", icon: Bot },
  { title: "Voice AI Calls", url: "/voice-calls", icon: Phone },
  { title: "Conversations", url: "/conversations", icon: MessageCircle },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone },
  { title: "Contacts", url: "/contacts", icon: UserCheck },
  { title: "Knowledge Base", url: "/knowledge-base", icon: Brain },
  { title: "Phone Management", url: "/trunk-management", icon: Network },
  { title: "CRM Integration", url: "/crm", icon: Database },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const adminItems = [
  { title: "Admin Panel", url: "/admin", icon: Shield },
  { title: "Settings", url: "/settings", icon: Settings },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { user } = useAuth();

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-gradient-to-r from-primary/20 to-accent/20 text-primary font-medium border-r-2 border-primary" : "hover:bg-muted/50";

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  return (
    <Sidebar className={collapsed ? "w-16" : "w-64"}>
      <SidebarContent className="bg-gradient-to-b from-background to-muted/30">
        {/* Logo */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-lg flex items-center justify-center">
              <Phone className="w-4 h-4 text-white" />
            </div>
            {!collapsed && <span className="font-bold text-lg">VoiceAI Pro</span>}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section - Only show for admin users */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className={getNavCls}>
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

      </SidebarContent>
    </Sidebar>
  );
}