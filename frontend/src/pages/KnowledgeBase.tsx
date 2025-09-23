import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  Upload, 
  FileText, 
  Trash2, 
  Plus, 
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bot,
  RefreshCw,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  pinecone_index_name: string;
  pinecone_index_status: string;
  total_documents: number;
  created_at: string;
  updated_at: string;
}

interface Document {
  id: string;
  knowledge_base_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

const KnowledgeBase = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedKB, setSelectedKB] = useState<string>('');
  const [loading, setLoading] = useState({
    knowledgeBases: false,
    documents: false,
    creating: false,
    uploading: false
  });

  // Form states
  const [kbName, setKbName] = useState('');
  const [kbDescription, setKbDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load knowledge bases on mount
  useEffect(() => {
    if (user) {
      fetchKnowledgeBases();
    }
  }, [user]);

  // Load documents when KB is selected
  useEffect(() => {
    if (selectedKB) {
      fetchDocuments(selectedKB);
    }
  }, [selectedKB]);

  const fetchKnowledgeBases = async () => {
    setLoading(prev => ({ ...prev, knowledgeBases: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const companyId = user?.id; // Use user ID as company ID
      const response = await fetch(`/api/v1/knowledge-base/knowledge-bases/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch knowledge bases');
      }

      const result = await response.json();
      console.log('Fetched knowledge bases:', result);
      setKnowledgeBases(result.knowledgeBases || []);
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
      toast({
        title: "Error",
        description: "Failed to fetch knowledge bases",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, knowledgeBases: false }));
    }
  };

  const fetchDocuments = async (kbId: string) => {
    setLoading(prev => ({ ...prev, documents: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`/api/v1/knowledge-base/knowledge-bases/${kbId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const result = await response.json();
      console.log('Fetched documents for KB:', kbId, result);
      setDocuments(result.knowledgeBase?.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to fetch documents",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, documents: false }));
    }
  };

  const createKnowledgeBase = async () => {
    if (!kbName.trim() || !kbDescription.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(prev => ({ ...prev, creating: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('/api/v1/knowledge-base/knowledge-bases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          companyId: user?.id, // Use user ID as company ID
          name: kbName.trim(),
          description: kbDescription.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create knowledge base');
      }

      toast({
        title: "Success!",
        description: "Knowledge base created successfully!",
      });

      setKbName('');
      setKbDescription('');
      fetchKnowledgeBases();
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      toast({
        title: "Error",
        description: "Failed to create knowledge base",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, creating: false }));
    }
  };

  const uploadDocument = async (file: File) => {
    if (!selectedKB) {
      toast({
        title: "Error",
        description: "Please select a knowledge base first",
        variant: "destructive",
      });
      return;
    }

    setLoading(prev => ({ ...prev, uploading: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', user?.id || '');
      formData.append('knowledgeBaseId', selectedKB);

      const response = await fetch('/api/v1/knowledge-base/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      toast({
        title: "Success!",
        description: "Document uploaded successfully!",
      });

      fetchDocuments(selectedKB);
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, uploading: false }));
    }
  };

  const deleteKnowledgeBase = async (kbId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`/api/v1/knowledge-base/knowledge-bases/${kbId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete knowledge base');
      }

      toast({
        title: "Success!",
        description: "Knowledge base deleted successfully!",
      });

      fetchKnowledgeBases();
      if (selectedKB === kbId) {
        setSelectedKB('');
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
      toast({
        title: "Error",
        description: "Failed to delete knowledge base",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Ready':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
      case 'Creating':
        return <Badge className="bg-yellow-100 text-yellow-800"><RefreshCw className="w-3 h-3 mr-1" />Creating</Badge>;
      case 'Failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800"><AlertCircle className="w-3 h-3 mr-1" />Unknown</Badge>;
    }
  };

  const getDocumentStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-800"><RefreshCw className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'uploading':
        return <Badge className="bg-blue-100 text-blue-800"><Upload className="w-3 h-3 mr-1" />Uploading</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800"><AlertCircle className="w-3 h-3 mr-1" />Unknown</Badge>;
    }
  };

  const filteredKnowledgeBases = knowledgeBases.filter(kb => 
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Knowledge Base
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your AI knowledge bases and documents for enhanced responses.
          </p>
        </div>
        <Button 
          onClick={fetchKnowledgeBases}
          variant="outline"
          disabled={loading.knowledgeBases}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading.knowledgeBases ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="knowledge-bases" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="knowledge-bases">Knowledge Bases</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge-bases" className="space-y-6">
          {/* Create Knowledge Base */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Knowledge Base
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="kb-name">Name</Label>
                  <Input
                    id="kb-name"
                    value={kbName}
                    onChange={(e) => setKbName(e.target.value)}
                    placeholder="Enter knowledge base name"
                  />
                </div>
                <div>
                  <Label htmlFor="kb-description">Description</Label>
                  <Input
                    id="kb-description"
                    value={kbDescription}
                    onChange={(e) => setKbDescription(e.target.value)}
                    placeholder="Enter description"
                  />
                </div>
              </div>
              <Button 
                onClick={createKnowledgeBase}
                disabled={loading.creating}
                className="w-full"
              >
                {loading.creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Create Knowledge Base
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search knowledge bases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Knowledge Bases List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading.knowledgeBases ? (
              <div className="col-span-full flex justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
            ) : filteredKnowledgeBases.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No knowledge bases found. Create your first one above!
              </div>
            ) : (
              filteredKnowledgeBases.map((kb) => (
                <Card key={kb.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{kb.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteKnowledgeBase(kb.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{kb.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Status:</span>
                      {getStatusBadge(kb.pinecone_index_status)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Documents:</span>
                      <span className="text-sm">{kb.total_documents}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Index:</span>
                      <span className="text-sm font-mono text-xs">{kb.pinecone_index_name}</span>
                    </div>
                    <Button
                      onClick={() => setSelectedKB(kb.id)}
                      className="w-full"
                      variant={selectedKB === kb.id ? "default" : "outline"}
                    >
                      {selectedKB === kb.id ? "Selected" : "Select"}
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          {!selectedKB ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please select a knowledge base from the Knowledge Bases tab to view and manage documents.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Upload Document */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Upload Document
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="document-upload">Select Document</Label>
                      <Input
                        id="document-upload"
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            uploadDocument(file);
                          }
                        }}
                        disabled={loading.uploading}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Supported formats: PDF, DOCX, TXT (Max 10MB)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Documents List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Documents
                  </CardTitle>
                  {selectedKB && (
                    <div className="text-sm text-muted-foreground">
                      Knowledge Base: {knowledgeBases.find(kb => kb.id === selectedKB)?.name || 'Unknown'}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {!selectedKB ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Please select a knowledge base above to view its documents.
                    </div>
                  ) : loading.documents ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No documents uploaded yet. Upload your first document above!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{doc.original_filename}</p>
                              <p className="text-sm text-muted-foreground">
                                {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getDocumentStatusBadge(doc.status)}
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KnowledgeBase;
