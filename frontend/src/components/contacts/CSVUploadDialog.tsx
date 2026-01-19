// components/contacts/CSVUploadDialog.tsx
import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { uploadCsvFile, parseCsvContent, CsvContact } from '@/lib/api/csv/csvService';

interface CSVUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: (csvFileId: string, contactCount: number) => void;
}

export function CSVUploadDialog({ open, onOpenChange, onUploadComplete }: CSVUploadDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CsvContact[]>([]);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; csvFileId?: string; contactCount?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);

    // Parse CSV for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      const contacts = parseCsvContent(csvText);
      setPreviewData(contacts);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const result = await uploadCsvFile(selectedFile);

      clearInterval(progressInterval);
      setUploadProgress(100);

      setUploadResult(result);

      if (result.success && result.csvFileId) {
        setTimeout(() => {
          onUploadComplete(result.csvFileId!, result.contactCount || 0);
          handleClose();
        }, 1500);
      }

    } catch (error) {
      console.error('Upload error:', error);
      setUploadResult({
        success: false,
        message: 'Upload failed. Please try again.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setUploadResult(null);
    setUploadProgress(0);
    onOpenChange(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Upload CSV File</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Selection */}
          {!selectedFile && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select CSV File</h3>
              <p className="text-gray-500 mb-4">
                Choose a CSV file containing contact information. Maximum file size: 10MB
              </p>
              <Button onClick={() => fileInputRef.current?.click()}>
                Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* File Selected */}
          {selectedFile && !uploadResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Preview */}
              {previewData.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">Preview ({previewData.length} contacts)</h4>
                    <Badge variant="secondary">
                      {previewData.length} contacts found
                    </Badge>
                  </div>

                  <div className="max-h-60 overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.slice(0, 10).map((contact, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {contact.first_name} {contact.last_name}
                            </TableCell>
                            <TableCell>{contact.email || '-'}</TableCell>
                            <TableCell>{contact.phone || '-'}</TableCell>
                            <TableCell>
                              <Badge
                                variant={contact.status === 'active' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {contact.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {previewData.length > 10 && (
                      <div className="p-3 text-center text-sm text-gray-500">
                        ... and {previewData.length - 10} more contacts
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">No valid contacts found in this file</p>
                      <p className="mt-1">
                        To upload successfully, your CSV must have a header row with at least a <b>First Name</b> (or "Name") column and either an <b>Email</b> or <b>Phone</b> column.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || previewData.length === 0}
                >
                  {isUploading ? 'Uploading...' : 'Upload CSV'}
                </Button>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading CSV file...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            </div>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div className="space-y-4">
              <div className={`flex items-center space-x-3 p-4 rounded-lg ${uploadResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
                }`}>
                {uploadResult.success ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-500" />
                )}
                <div>
                  <p className={`font-medium ${uploadResult.success ? 'text-green-900' : 'text-red-900'
                    }`}>
                    {uploadResult.success ? 'Upload Successful!' : 'Upload Failed'}
                  </p>
                  <p className={`text-sm ${uploadResult.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                    {uploadResult.message}
                  </p>
                </div>
              </div>

              {uploadResult.success && (
                <div className="flex justify-end">
                  <Button onClick={handleClose}>
                    Close
                  </Button>
                </div>
              )}

              {!uploadResult.success && (
                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                  <Button onClick={() => setUploadResult(null)}>
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
