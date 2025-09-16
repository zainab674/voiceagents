// components/campaigns/TermsOfUseDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

interface TermsOfUseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted: () => void;
}

export function TermsOfUseDialog({ open, onOpenChange, onAccepted }: TermsOfUseDialogProps) {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    if (accepted) {
      onAccepted();
    }
  };

  const handleClose = () => {
    setAccepted(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Terms of Use for Outbound Calling</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="space-y-4 text-sm text-gray-700">
            <p>
              Before creating and launching outbound calling campaigns, please review and accept our terms of use:
            </p>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Compliance Requirements</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>You must comply with all applicable telemarketing laws and regulations, including TCPA, CAN-SPAM, and state-specific requirements</li>
                <li>You are responsible for maintaining accurate do-not-call lists and respecting opt-out requests</li>
                <li>You must obtain proper consent before making calls to any phone numbers</li>
                <li>You are responsible for ensuring all contact data is legally obtained and up-to-date</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Calling Hours and Restrictions</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Respect calling hours (typically 8 AM - 9 PM local time for residential numbers)</li>
                <li>Do not call numbers on the National Do Not Call Registry without proper consent</li>
                <li>Implement proper call frequency limits to avoid harassment</li>
                <li>Provide clear identification and purpose of the call</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Data Protection and Privacy</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Protect all contact information and call data according to privacy laws</li>
                <li>Implement appropriate security measures for stored data</li>
                <li>Respect individual privacy rights and data protection regulations</li>
                <li>Maintain accurate records of consent and opt-out requests</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Campaign Content and Scripts</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Ensure all campaign content is truthful and not misleading</li>
                <li>Include proper identification and contact information</li>
                <li>Provide clear opt-out instructions in all communications</li>
                <li>Respect recipient preferences and requests</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Liability and Responsibility</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>You are solely responsible for compliance with all applicable laws and regulations</li>
                <li>You will indemnify and hold harmless the platform from any legal claims arising from your campaigns</li>
                <li>You understand that violation of these terms may result in immediate suspension of your account</li>
                <li>You will monitor and audit your campaigns regularly to ensure compliance</li>
              </ul>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> These terms are a summary. Please consult with legal counsel to ensure full compliance with all applicable laws and regulations in your jurisdiction.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="accept-terms"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked as boolean)}
            />
            <label
              htmlFor="accept-terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I have read and agree to the terms of use for outbound calling
            </label>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleAccept}
              disabled={!accepted}
            >
              Accept and Continue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
