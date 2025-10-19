// pages/Contacts.tsx
import React, { useState } from 'react';
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
        <div className="space-y-6">
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
        </div>
      </div>
    </div>
  );
}
