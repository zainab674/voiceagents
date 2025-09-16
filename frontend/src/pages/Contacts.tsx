// pages/Contacts.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Upload, Users, FileText } from 'lucide-react';
import { CSVFileList } from '@/components/contacts/CSVFileList';
import { CSVContactsPreview } from '@/components/contacts/CSVContactsPreview';
// DashboardLayout removed - AppLayout is already applied at route level

export default function Contacts() {
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  const handleFileSelect = (fileId: string, fileName: string) => {
    setSelectedFileId(fileId);
    setSelectedFileName(fileName);
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setSelectedFileId('');
    setSelectedFileName('');
  };

  return (
    <div className="container mx-auto px-6 max-w-7xl">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-gray-600">
            Manage your contact lists and upload CSV files for campaign creation
          </p>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="csv-files" className="space-y-6">
          <TabsList>
            <TabsTrigger value="csv-files" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              CSV Files
            </TabsTrigger>
            <TabsTrigger value="contact-lists" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contact Lists
            </TabsTrigger>
          </TabsList>

          <TabsContent value="csv-files" className="space-y-6">
            {showPreview && selectedFileId ? (
              <CSVContactsPreview
                csvFileId={selectedFileId}
                csvFileName={selectedFileName}
                onClose={handleClosePreview}
              />
            ) : (
              <CSVFileList
                onFileSelect={handleFileSelect}
                selectedFileId={selectedFileId}
              />
            )}
          </TabsContent>

          <TabsContent value="contact-lists" className="space-y-6">
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Contact Lists Coming Soon
              </h3>
              <p className="text-gray-600 mb-6">
                Manual contact list management will be available in a future update.
              </p>
              <div className="flex justify-center gap-3">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create List
                </Button>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import List
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
