// components/campaigns/DeleteCampaignDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DeleteCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  campaignName: string;
  isRunning: boolean;
  loading: boolean;
}

export function DeleteCampaignDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  campaignName, 
  isRunning, 
  loading 
}: DeleteCampaignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Delete Campaign
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the campaign <strong>"{campaignName}"</strong>?
          </p>

          {isRunning && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This campaign is currently running. Stopping it will immediately halt all ongoing calls and cannot be undone.
              </p>
            </div>
          )}

          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>This action cannot be undone.</strong> All campaign data, call history, and statistics will be permanently deleted.
            </p>
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete Campaign"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
