// pages/Campaigns.tsx
import { useState, useEffect } from 'react';
// DashboardLayout removed - AppLayout is already applied at route level
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Pause, Trash2, Plus, BarChart3, Eye, AlertCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { TermsOfUseDialog } from "@/components/campaigns/TermsOfUseDialog";
import { CampaignSettingsDialog } from "@/components/campaigns/CampaignSettingsDialog";
import { CampaignDetailsDialog } from "@/components/campaigns/CampaignDetailsDialog";
import { DeleteCampaignDialog } from "@/components/campaigns/DeleteCampaignDialog";
import { fetchCampaigns, Campaign } from "@/lib/api/campaigns/fetchCampaigns";
import { saveCampaign, SaveCampaignRequest } from "@/lib/api/campaigns/saveCampaign";
import { startCampaign } from "@/lib/api/campaigns/startCampaign";
import { pauseCampaign } from "@/lib/api/campaigns/pauseCampaign";
import { resumeCampaign } from "@/lib/api/campaigns/resumeCampaign";
import { stopCampaign } from "@/lib/api/campaigns/stopCampaign";
import { deleteCampaign as deleteCampaignAPI } from "@/lib/api/campaigns/deleteCampaign";
import { getCampaignStatus } from "@/lib/api/campaigns/getCampaignStatus";
import { useAuth } from "@/contexts/AuthContext";

export default function Campaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [termsOpen, setTermsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedCampaignName, setSelectedCampaignName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'network' | 'permission' | 'backend' | 'unknown' | null>(null);

  const loadCampaigns = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);
    setErrorType(null);

    try {
      const response = await fetchCampaigns();
      setCampaigns(response.campaigns || []);
    } catch (err: any) {
      console.error('Error loading campaigns:', err);

      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);

      if (errorMessage.includes('Authentication') || errorMessage.includes('token') || errorMessage.includes('Permission')) {
        setErrorType('permission');
      } else if (errorMessage.includes('HTTP error! status: 5') || errorMessage.includes('Failed to fetch')) {
        setErrorType('backend');
      } else if (errorMessage.includes('network') || errorMessage.includes('offline')) {
        setErrorType('network');
      } else {
        setErrorType('unknown');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load campaigns from database
  useEffect(() => {
    loadCampaigns();
  }, [user?.id]);

  const handleNewCampaign = () => {
    setTermsOpen(true);
  };

  const handleTermsAccepted = () => {
    setTermsOpen(false);
    setSettingsOpen(true);
  };

  const handleCampaignCreated = async (campaignData: any) => {
    if (!user?.id) return;

    try {
      const saveData: SaveCampaignRequest = {
        name: campaignData.name,
        assistantId: campaignData.assistantId,
        contactSource: campaignData.contactSource,
        contactListId: campaignData.contactListId,
        csvFileId: campaignData.csvFileId,
        dailyCap: campaignData.dailyCap,
        callingDays: campaignData.callingDays,
        startHour: campaignData.startHour,
        endHour: campaignData.endHour,
        campaignPrompt: campaignData.campaignPrompt,
        userId: user.id
      };

      const result = await saveCampaign(saveData);

      if (result.success) {
        // Reload campaigns from database
        const response = await fetchCampaigns();
        setCampaigns(response.campaigns);
        setSettingsOpen(false);
      } else {
        console.error('Error saving campaign:', result.error);
        alert('Error saving campaign: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Error creating campaign: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const toggleCampaignStatus = async (id: string) => {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;

    try {
      if (campaign.execution_status === 'running') {
        // Pause the campaign
        const result = await pauseCampaign({ campaignId: id });
        if (result.success) {
          setCampaigns(prev => prev.map(c =>
            c.id === id
              ? { ...c, execution_status: 'paused' as const }
              : c
          ));
        } else {
          console.error('Error pausing campaign:', result.error);
        }
      } else if (campaign.execution_status === 'paused') {
        // Resume the campaign
        const result = await resumeCampaign({ campaignId: id });
        if (result.success) {
          setCampaigns(prev => prev.map(c =>
            c.id === id
              ? { ...c, execution_status: 'running' as const }
              : c
          ));
        } else {
          console.error('Error resuming campaign:', result.error);
        }
      } else if (campaign.execution_status === 'idle') {
        // Start the campaign
        const result = await startCampaign({ campaignId: id });
        if (result.success) {
          setCampaigns(prev => prev.map(c =>
            c.id === id
              ? { ...c, execution_status: 'running' as const }
              : c
          ));
        } else {
          console.error('Error starting campaign:', result.error);
        }
      }
    } catch (error) {
      console.error('Error toggling campaign status:', error);
    }
  };

  const handleDeleteCampaign = (id: string, name: string) => {
    setSelectedCampaignId(id);
    setSelectedCampaignName(name);
    setDeleteOpen(true);
  };

  const confirmDeleteCampaign = async () => {
    if (!selectedCampaignId) return;

    setDeleting(true);
    try {
      const result = await deleteCampaignAPI(selectedCampaignId);

      if (result.success) {
        // Remove from local state
        setCampaigns(prev => prev.filter(campaign => campaign.id !== selectedCampaignId));
        setDeleteOpen(false);
        setSelectedCampaignId('');
        setSelectedCampaignName('');
      } else {
        console.error('Error deleting campaign:', result.error);
        alert('Error deleting campaign: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Error deleting campaign: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  const openCampaignDetails = (campaignId: string, campaignName: string) => {
    setSelectedCampaignId(campaignId);
    setSelectedCampaignName(campaignName);
    setDetailsOpen(true);
  };

  const getStatusBadge = (executionStatus: Campaign['execution_status']) => {
    const variants = {
      idle: { variant: 'outline' as const, className: 'bg-muted/10 text-muted-foreground border-muted/30 hover:bg-muted/20' },
      running: { variant: 'default' as const, className: 'bg-success/10 text-success border-success/20 hover:bg-success/20' },
      paused: { variant: 'secondary' as const, className: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20' },
      completed: { variant: 'outline' as const, className: 'bg-muted/10 text-muted-foreground border-muted/30 hover:bg-muted/20' },
      error: { variant: 'destructive' as const, className: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20' }
    };

    const config = variants[executionStatus] || variants.idle;
    return (
      <Badge variant={config.variant} className={config.className}>
        {executionStatus.charAt(0).toUpperCase() + executionStatus.slice(1)}
      </Badge>
    );
  };

  if (loading && campaigns.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-12 h-12 mx-auto text-primary animate-spin opacity-50" />
          <p className="text-muted-foreground font-light text-lg">Loading your campaigns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white border border-destructive/20 rounded-2xl p-8 shadow-xl shadow-destructive/5 text-center space-y-6"
        >
          <div className="relative mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-destructive/10">
            {errorType === 'permission' ? (
              <ShieldAlert className="w-10 h-10 text-destructive" />
            ) : (
              <AlertCircle className="w-10 h-10 text-destructive" />
            )}
            <div className="absolute inset-0 rounded-full border-2 border-destructive animate-ping opacity-20" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {errorType === 'permission' ? 'Access Denied' :
                errorType === 'backend' ? 'Backend Unavailable' :
                  'Failed to Load Data'}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {errorType === 'permission' ? 'You don\'t have permission to view these campaigns or your session has expired.' :
                errorType === 'backend' ? 'We\'re having trouble connecting to our servers. Please try again in a moment.' :
                  error || 'An unexpected error occurred while fetching your campaigns.'}
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => loadCampaigns()}
              className="w-full h-12 text-md font-medium transition-all hover:scale-[1.02]"
              variant="default"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Campaigns
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Error code: {errorType?.toUpperCase() || 'UNKNOWN_ERROR'}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <BarChart3 className="w-16 h-16 mx-auto text-primary/60" />
                  <h1 className="text-5xl font-extralight tracking-tight text-foreground">
                    Create And Launch Your First Campaign
                  </h1>
                  <p className="text-xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
                    Launch your AI agents and start creating amazing campaigns that will help you connect with your customers in a meaningful way.
                  </p>
                </div>

                <Button
                  onClick={handleNewCampaign}
                  size="lg"
                  className="px-8 py-3 text-lg font-medium"
                >
                  Launch a campaign
                </Button>
              </motion.div>
            </div>
          </div>

          <TermsOfUseDialog
            open={termsOpen}
            onOpenChange={setTermsOpen}
            onAccepted={handleTermsAccepted}
          />

          <CampaignSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            onSave={handleCampaignCreated}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="container mx-auto px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-6">
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-col space-y-2">
                <h1 className="text-4xl font-extralight tracking-tight text-foreground">
                  Campaigns
                </h1>
                <p className="text-muted-foreground text-lg font-light">
                  Manage and monitor your AI agent campaigns
                </p>
              </div>

              <Button onClick={handleNewCampaign} className="px-6">
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Status</TableHead>
                      <TableHead className="min-w-[150px]">Name</TableHead>
                      <TableHead className="min-w-[100px]">Daily Cap</TableHead>
                      <TableHead className="min-w-[150px]">Assistant</TableHead>
                      <TableHead className="min-w-[150px]">Contact Source</TableHead>

                      <TableHead className="min-w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8">
                          Loading campaigns...
                        </TableCell>
                      </TableRow>
                    ) : campaigns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8">
                          No campaigns found. Create your first campaign to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      campaigns.map((campaign) => (
                        <TableRow key={campaign.id} className="hover:bg-gray-50">
                          <TableCell className="px-4 py-3">
                            {getStatusBadge(campaign.execution_status)}
                          </TableCell>
                          <TableCell className="px-4 py-3 font-medium">
                            <Button
                              variant="link"
                              className="p-0 h-auto font-medium text-left text-primary hover:text-primary/80"
                              onClick={() => openCampaignDetails(campaign.id, campaign.name)}
                            >
                              {campaign.name}
                            </Button>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {campaign.daily_cap}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {campaign.assistant_name || 'Unknown'}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {campaign.contact_source === 'contact_list'
                              ? (campaign.contact_list_name || 'Unknown List')
                              : (campaign.csv_file_name || 'Unknown CSV')
                            }
                          </TableCell>


                          <TableCell className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openCampaignDetails(campaign.id, campaign.name)}
                                className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleCampaignStatus(campaign.id)}
                                className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                              >
                                {campaign.execution_status === 'running' ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                                className="text-destructive hover:text-destructive/80 h-8 w-8 p-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TermsOfUseDialog
        open={termsOpen}
        onOpenChange={setTermsOpen}
        onAccepted={handleTermsAccepted}
      />

      <CampaignSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSave={handleCampaignCreated}
      />

      <CampaignDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        campaignId={selectedCampaignId}
        campaignName={selectedCampaignName}
      />

      <DeleteCampaignDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDeleteCampaign}
        campaignName={selectedCampaignName}
        isRunning={campaigns.find(c => c.id === selectedCampaignId)?.execution_status === 'running'}
        loading={deleting}
      />
    </div>
  );
}
