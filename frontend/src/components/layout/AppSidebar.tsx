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
  Bot,
  Instagram,
  Key,
  Lightbulb,
  CreditCard,
  LogOut
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWebsiteSettings } from "@/contexts/WebsiteSettingsContext";
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
  { title: "Opportunities", url: "/opportunities", icon: Lightbulb },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone },
  { title: "Contacts", url: "/contacts", icon: UserCheck },
  { title: "Knowledge Base", url: "/knowledge-base", icon: Brain },
  { title: "Phone Management", url: "/trunk-management", icon: Network },
  { title: "Twilio Credentials", url: "/trunk-management?tab=credentials", icon: Key },
  { title: "Email Automation", url: "/email-automation", icon: Mail },
  { title: "CRM Integration", url: "/crm", icon: Database },
  { title: "Social Integrations", url: "/social-integrations", icon: MessageSquare },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Contact Us", url: "/contact", icon: MessageSquare },
];

const adminItems = [
  { title: "Admin Panel", url: "/admin", icon: Shield },
  { title: "Website Settings", url: "/white-label", icon: FileText },
  { title: "Stripe Config", url: "/admin?tab=stripe", icon: CreditCard },
  { title: "Instagram Integration", url: "/instagram", icon: Instagram },
  { title: "Settings", url: "/settings", icon: Settings },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, logout } = useAuth();
  const { settings } = useWebsiteSettings();
  const camelCaseWebsiteName = (settings as { websiteName?: string | null } | null)?.websiteName;
  const companyName = settings?.website_name || camelCaseWebsiteName || 'VoiceAI Pro';
  const companyLogo = settings?.logo;

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) => {
    const base =
      "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150 text-slate-300 hover:bg-slate-800/70";
    const active =
      "bg-slate-900 text-white border-l-2 border-primary font-semibold";
    return isActive ? `${base} ${active}` : base;
  };

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  return (
    <Sidebar className={collapsed ? "w-16" : "w-64 bg-slate-950 text-slate-200"}>
      <SidebarContent className="bg-slate-950 text-slate-200 border-r border-slate-800 flex flex-col">
        {/* Brand / Workspace */}
        <div className="px-3 py-4 border-b border-slate-800">
          <NavLink to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden ring-1 ring-slate-700">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="h-full w-full object-contain bg-white"
                />
              ) : (
                <Phone className="w-4 h-4 text-primary" />
              )}
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold truncate">
                  {companyName}
                </span>
                <span className="text-[11px] text-slate-400">
                  Workspace
                </span>
              </div>
            )}
          </NavLink>
        </div>

        {/* Main Navigation */}
        <SidebarGroup className="mt-3">
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Main
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-4 w-4" />
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
          <SidebarGroup className="mt-4 border-t border-slate-800 pt-3">
            {!collapsed && (
              <SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Administration
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {/* User Section - Logged in user info and Sign Out */}
        <div className="mt-auto border-t border-slate-800 p-4">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-400/10 transition-colors duration-150"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}