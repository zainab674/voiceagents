import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Edit, Save, X, Loader2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const UserProfile: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editData, setEditData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || ''
  });

  if (!user) {
    return null;
  }

  const handleEdit = () => {
    setEditData({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || ''
    });
    setIsEditing(true);
    setError('');
    setSuccess('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await updateUser(editData);
      setSuccess('Profile updated successfully');
      setIsEditing(false);
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Navigate to landing page after logout
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-2xl font-semibold bg-blue-100 text-blue-600">
              {getInitials(user.firstName, user.lastName)}
            </AvatarFallback>
          </Avatar>
        </div>
        <CardTitle className="text-2xl">Profile</CardTitle>
        <CardDescription>
          Manage your account information and preferences
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              {isEditing ? (
                <Input
                  id="firstName"
                  value={editData.firstName}
                  onChange={(e) => setEditData(prev => ({ ...prev, firstName: e.target.value }))}
                  disabled={loading}
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {user.firstName}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              {isEditing ? (
                <Input
                  id="lastName"
                  value={editData.lastName}
                  onChange={(e) => setEditData(prev => ({ ...prev, lastName: e.target.value }))}
                  disabled={loading}
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {user.lastName}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="p-3 bg-gray-50 rounded-md border">
              {user.email}
            </div>
            <p className="text-sm text-gray-500">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            {isEditing ? (
              <Input
                id="phone"
                type="tel"
                value={editData.phone}
                onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Enter phone number"
                disabled={loading}
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border">
                {user.phone || 'Not provided'}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                onClick={handleEdit}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </div>

          <Button
            onClick={handleLogout}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
