// components/contacts/CSVContactsPreview.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Users, Phone, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { fetchCsvContacts, fetchCsvStats, CsvContact, CsvStats } from '@/lib/api/csv/csvService';

interface CSVContactsPreviewProps {
  csvFileId: string;
  csvFileName: string;
  onClose: () => void;
}

export function CSVContactsPreview({ csvFileId, csvFileName, onClose }: CSVContactsPreviewProps) {
  const [contacts, setContacts] = useState<CsvContact[]>([]);
  const [stats, setStats] = useState<CsvStats | null>(null);
  const [loading, setLoading] = useState(true);
  // Search functionality removed to avoid duplicate with global search bar
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const contactsPerPage = 50;

  useEffect(() => {
    loadContacts();
    loadStats();
  }, [csvFileId, currentPage]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * contactsPerPage;
      const result = await fetchCsvContacts(csvFileId, contactsPerPage, offset);
      
      if (result.success) {
        setContacts(result.contacts);
        setTotalPages(Math.ceil((result.contacts.length + offset) / contactsPerPage));
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await fetchCsvStats(csvFileId);
      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Show all contacts since search is handled by global search bar
  const filteredContacts = contacts;

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '-';
    // Basic phone number formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getStatusBadge = (status: string, doNotCall: boolean) => {
    if (doNotCall) {
      return <Badge variant="destructive" className="text-xs">Do Not Call</Badge>;
    }
    
    switch (status) {
      case 'active':
        return <Badge variant="default" className="text-xs">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary" className="text-xs">Inactive</Badge>;
      case 'do-not-call':
        return <Badge variant="destructive" className="text-xs">Do Not Call</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading contacts...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Loading contacts from {csvFileName}...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {csvFileName}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {stats ? `${stats.total} contacts` : 'Loading...'}
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-blue-600">Total</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-sm text-green-600">Active</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.withPhone}</div>
              <div className="text-sm text-yellow-600">With Phone</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.withEmail}</div>
              <div className="text-sm text-purple-600">With Email</div>
            </div>
          </div>
        )}

        {/* Search removed to avoid duplicate with global search bar */}

        {/* Contacts Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>DNC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No contacts found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {contact.first_name} {contact.last_name}
                        {contact.do_not_call && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4 text-gray-400" />
                        {contact.email || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4 text-gray-400" />
                        {formatPhoneNumber(contact.phone || '')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(contact.status, contact.do_not_call)}
                    </TableCell>
                    <TableCell>
                      {contact.do_not_call ? (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">Yes</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">No</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
