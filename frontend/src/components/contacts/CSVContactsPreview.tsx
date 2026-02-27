// components/contacts/CSVContactsPreview.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Users, Phone, Mail, AlertCircle, CheckCircle, Edit2, Trash2, Plus, Save, X, MoreHorizontal } from 'lucide-react';
import { fetchCsvContacts, fetchCsvStats, addContact, updateContact, deleteContact, CsvContact, CsvStats } from '@/lib/api/csv/csvService';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

interface CSVContactsPreviewProps {
  csvFileId: string;
  csvFileName: string;
  onClose: () => void;
}

export function CSVContactsPreview({ csvFileId, csvFileName, onClose }: CSVContactsPreviewProps) {
  const [contacts, setContacts] = useState<CsvContact[]>([]);
  const [stats, setStats] = useState<CsvStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CsvContact>>({});

  // Adding state
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState<Partial<CsvContact>>({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    do_not_call: false
  });

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

  const handleEdit = (contact: CsvContact) => {
    setEditingId(contact.id);
    setEditForm({ ...contact });
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      const result = await updateContact(editingId, editForm);
      if (result.success && result.contact) {
        setContacts(prev => prev.map(c => c.id === editingId ? result.contact! : c));
        setEditingId(null);
        loadStats();
      } else {
        alert('Failed to update contact: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving contact:', error);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      const result = await deleteContact(contactId);
      if (result.success) {
        setContacts(prev => prev.filter(c => c.id !== contactId));
        loadStats();
      } else {
        alert('Failed to delete contact: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };

  const handleSaveNew = async () => {
    try {
      const result = await addContact(csvFileId, newContact);
      if (result.success && result.contact) {
        setContacts(prev => [result.contact!, ...prev]);
        setIsAdding(false);
        setNewContact({
          first_name: '',
          last_name: '',
          phone: '',
          email: '',
          do_not_call: false
        });
        loadStats();
      } else {
        alert('Failed to add contact: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  };

  const handleToggleDNC = async (contact: CsvContact) => {
    try {
      const result = await updateContact(contact.id, { do_not_call: !contact.do_not_call });
      if (result.success && result.contact) {
        setContacts(prev => prev.map(c => c.id === contact.id ? result.contact! : c));
        loadStats();
      }
    } catch (error) {
      console.error('Error toggling DNC:', error);
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)} disabled={isAdding}>
              <Plus className="h-4 w-4 mr-1" />
              Add Contact
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Preview
            </Button>
          </div>
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
              {isAdding && (
                <TableRow className="bg-blue-50/50">
                  <TableCell>
                    <div className="flex gap-2">
                      <Input
                        placeholder="First Name"
                        value={newContact.first_name}
                        onChange={(e) => setNewContact(prev => ({ ...prev, first_name: e.target.value }))}
                        className="h-8 text-xs"
                      />
                      <Input
                        placeholder="Last Name"
                        value={newContact.last_name}
                        onChange={(e) => setNewContact(prev => ({ ...prev, last_name: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Email"
                      value={newContact.email}
                      onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">New</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={newContact.do_not_call}
                          onCheckedChange={(checked) => setNewContact(prev => ({ ...prev, do_not_call: !!checked }))}
                        />
                        <span className="text-xs">DNC</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleSaveNew}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => setIsAdding(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filteredContacts.length === 0 && !isAdding ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No contacts found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className={editingId === contact.id ? 'bg-blue-50/30' : ''}>
                    <TableCell className="font-medium">
                      {editingId === contact.id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editForm.first_name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                            className="h-8 text-xs"
                          />
                          <Input
                            value={editForm.last_name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                            className="h-8 text-xs"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {contact.first_name} {contact.last_name}
                          {contact.do_not_call && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === contact.id ? (
                        <Input
                          value={editForm.email}
                          onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4 text-gray-400" />
                          {contact.email || '-'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === contact.id ? (
                        <Input
                          value={editForm.phone}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4 text-gray-400" />
                          {formatPhoneNumber(contact.phone || '')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(contact.status, contact.do_not_call)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-between">
                        {editingId === contact.id ? (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={editForm.do_not_call}
                              onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, do_not_call: !!checked }))}
                            />
                            <span className="text-xs">DNC</span>
                          </div>
                        ) : (
                          contact.do_not_call ? (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-sm">Yes</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">No</span>
                            </div>
                          )
                        )}

                        <div className="flex items-center gap-1">
                          {editingId === contact.id ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleSave}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={handleCancel}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(contact)}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleDNC(contact)}>
                                  <AlertCircle className="h-4 w-4 mr-2" />
                                  Toggle DNC
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(contact.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
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
