// components/contacts/CSVFileList.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, Eye, Trash2, Users, Calendar } from 'lucide-react';
import { fetchCsvFiles, fetchCsvStats, deleteCsvFile, CsvFile } from '@/lib/api/csv/csvService';
import { CSVUploadDialog } from './CSVUploadDialog';

interface CSVFileListProps {
  onFileSelect: (fileId: string, fileName: string) => void;
  selectedFileId?: string;
}

export function CSVFileList({ onFileSelect, selectedFileId }: CSVFileListProps) {
  const [csvFiles, setCsvFiles] = useState<CsvFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  useEffect(() => {
    loadCsvFiles();
  }, []);

  const loadCsvFiles = async () => {
    try {
      setLoading(true);
      const result = await fetchCsvFiles();
      if (result.success) {
        setCsvFiles(result.csvFiles);
      }
    } catch (error) {
      console.error('Error loading CSV files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (csvFileId: string, contactCount: number) => {
    loadCsvFiles();
    onFileSelect(csvFileId, '');
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingFileId(fileId);
      const result = await deleteCsvFile(fileId);
      
      if (result.success) {
        setCsvFiles(prev => prev.filter(file => file.id !== fileId));
        if (selectedFileId === fileId) {
          onFileSelect('', '');
        }
      } else {
        alert(`Failed to delete file: ${result.message}`);
        if (result.campaigns && result.campaigns.length > 0) {
          alert(`This file is being used by the following campaigns: ${result.campaigns.map(c => c.name).join(', ')}`);
        }
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file. Please try again.');
    } finally {
      setDeletingFileId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Loading CSV files...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              CSV Files
            </CardTitle>
            <Button onClick={() => setUploadDialogOpen(true)} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {csvFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No CSV files uploaded yet</p>
              <p className="text-sm mb-4">Upload your first CSV file to get started</p>
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV File
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvFiles.map((file) => (
                    <TableRow 
                      key={file.id}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        selectedFileId === file.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => onFileSelect(file.id, file.name)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          {file.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-gray-500" />
                          <Badge variant="secondary" className="text-xs">
                            {file.contact_count || file.row_count}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {formatFileSize(file.file_size)}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(file.uploaded_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onFileSelect(file.id, file.name);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file.id, file.name);
                            }}
                            disabled={deletingFileId === file.id}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CSVUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={handleUploadComplete}
      />
    </>
  );
}
