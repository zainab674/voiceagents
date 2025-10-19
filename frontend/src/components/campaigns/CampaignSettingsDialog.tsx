// components/campaigns/CampaignSettingsDialog.tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Settings } from "lucide-react";
import { fetchAssistants, Assistant } from "@/lib/api/assistants/fetchAssistants";
import { fetchCsvFiles, CsvFile } from "@/lib/api/csv/csvService";
import { useAuth } from "@/contexts/AuthContext";

interface CampaignSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CampaignSettingsData) => void;
}

interface CampaignSettingsData {
  name: string;
  assistantId: string;
  csvFileId: string;
  dailyCap: number;
  callingDays: string[];
  startHour: number;
  endHour: number;
  campaignPrompt: string;
}

const daysOfWeek = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
  { id: 'saturday', label: 'Saturday' },
  { id: 'sunday', label: 'Sunday' }
];

export function CampaignSettingsDialog({ open, onOpenChange, onSave }: CampaignSettingsDialogProps) {
  const { user } = useAuth();
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [csvFiles, setCsvFiles] = useState<CsvFile[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<CampaignSettingsData>({
    name: '',
    assistantId: '',
    csvFileId: '',
    dailyCap: 100,
    callingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    startHour: 9,
    endHour: 17,
    campaignPrompt: ''
  });

  // Fetch data when dialog opens
  useEffect(() => {
    if (open && user?.id) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const [assistantsRes, csvFilesRes] = await Promise.all([
            fetchAssistants(),
            fetchCsvFiles()
          ]);
          
          // fetchAssistants returns Assistant[] directly
          setAssistants(assistantsRes || []);
          // fetchCsvFiles returns { success: boolean, csvFiles: CsvFile[] }
          if (csvFilesRes.success) {
            setCsvFiles(csvFilesRes.csvFiles || []);
          } else {
            console.error('Failed to fetch CSV files:', csvFilesRes.error);
            setCsvFiles([]);
          }
        } catch (error) {
          console.error('Error fetching campaign data:', error);
          // Set empty arrays on error to prevent undefined errors
          setAssistants([]);
          setCsvFiles([]);
        } finally {
          setLoading(false);
        }
      };
      
      fetchData();
    }
  }, [open, user?.id]);

  const handleSave = () => {
    if (!formData.name || !formData.assistantId || !formData.csvFileId) {
      return; // Basic validation
    }
    
    onSave(formData);
    
    // Reset form
    setFormData({
      name: '',
      assistantId: '',
      csvFileId: '',
      dailyCap: 100,
      callingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      startHour: 9,
      endHour: 17,
      campaignPrompt: ''
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleDayToggle = (dayId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        callingDays: [...prev.callingDays, dayId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        callingDays: prev.callingDays.filter(day => day !== dayId)
      }));
    }
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12:00 AM';
    if (hour === 24) return '12:00 AM'; // 24:00 is midnight (end of day)
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-3 flex-shrink-0">
          <DialogTitle className="text-xl font-semibold text-foreground">
            Campaign Settings
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure your campaign parameters and preferences
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name" className="text-sm font-medium text-foreground">
                Campaign Name
              </Label>
              <Input
                id="campaign-name"
                placeholder="Enter campaign name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Assistant</Label>
                <Select
                  value={formData.assistantId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, assistantId: value }))}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loading ? "Loading assistants..." : "Select an assistant"} />
                  </SelectTrigger>
                  <SelectContent>
                    {assistants?.map((assistant) => (
                      <SelectItem key={assistant.id} value={assistant.id}>
                        {assistant.name}
                      </SelectItem>
                    )) || []}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="daily-cap" className="text-sm font-medium text-foreground">
                  Daily Usage Cap
                </Label>
                <Input
                  id="daily-cap"
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.dailyCap}
                  onChange={(e) => setFormData(prev => ({ ...prev, dailyCap: parseInt(e.target.value) || 0 }))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">CSV File</Label>
              <Select
                value={formData.csvFileId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, csvFileId: value }))}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={loading ? "Loading CSV files..." : "Select a CSV file"} />
                </SelectTrigger>
                <SelectContent>
                  {csvFiles?.map((file) => (
                    <SelectItem key={file.id} value={file.id}>
                      {file.name} ({file.row_count || 0} contacts)
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campaign Prompt */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="campaign-prompt" className="text-sm font-medium text-foreground">
                  Campaign Prompt
                </Label>
                <Textarea
                  id="campaign-prompt"
                  placeholder="Enter the script for your AI agent to follow during calls. Use placeholders like {name}, {email}, {phone} for personalization."
                  value={formData.campaignPrompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, campaignPrompt: e.target.value }))}
                  className="w-full min-h-[120px]"
                />
                <div className="text-xs text-muted-foreground">
                  <p className="mb-1">Available placeholders:</p>
                  <div className="flex flex-wrap gap-2">
                    <code className="px-2 py-1 bg-muted rounded text-xs">{'{name}'}</code>
                    <code className="px-2 py-1 bg-muted rounded text-xs">{'{email}'}</code>
                    <code className="px-2 py-1 bg-muted rounded text-xs">{'{phone}'}</code>
                  </div>
                </div>
              </div>

              {/* Prompt Preview */}
              {formData.campaignPrompt && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Preview (with sample data)
                  </Label>
                  <div className="p-4 bg-muted rounded-lg border">
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {formData.campaignPrompt
                        .replace(/{name}/g, 'John Smith')
                        .replace(/{email}/g, 'john@example.com')
                        .replace(/{phone}/g, '+1 (555) 123-4567')
                      }
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Schedule Settings */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                Calling Days
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {daysOfWeek.map((day) => (
                  <div key={day.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={day.id}
                      checked={formData.callingDays.includes(day.id)}
                      onCheckedChange={(checked) => handleDayToggle(day.id, checked as boolean)}
                    />
                    <Label htmlFor={day.id} className="text-sm font-normal text-foreground cursor-pointer">
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                Local Calling Hours
              </Label>
              <div className="space-y-3">
                <div className="px-4">
                  <Slider
                    value={[formData.startHour, formData.endHour === 0 ? 24 : formData.endHour]}
                    onValueChange={([start, end]) => 
                      setFormData(prev => ({ 
                        ...prev, 
                        startHour: start, 
                        endHour: end === 24 ? 24 : end 
                      }))
                    }
                    min={0}
                    max={24}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Start: {formatHour(formData.startHour)}</span>
                  <span>End: {(formData.startHour === 0 && formData.endHour === 0) ? '24/7' : formatHour(formData.endHour)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.name || !formData.assistantId || !formData.csvFileId}
              className="px-6"
            >
              Finish
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
