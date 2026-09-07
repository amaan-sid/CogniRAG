'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Camera, Lock, CheckCircle2, AlertCircle, Eye, EyeOff, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, updateUser } = useAuth();

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [profilePic, setProfilePic] = useState<string | null>(null);

  // Password fields
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Status
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize values when modal opens or user updates
  useEffect(() => {
    if (user) {
      setDisplayName(user.name || '');
      setUsername(user.username || '');
      setGender(user.gender || '');
      setProfilePic(user.profilePic || null);
    }
    setError(null);
    setSuccess(null);
    setPasswordError(null);
    setPasswordSuccess(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordSection(false);
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  // Compute initials (e.g. Mohd Amaan -> MA)
  const getInitials = (nameStr: string) => {
    const parts = nameStr.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Compress & convert selected image to base64 Data URL
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WEBP, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large (max 10MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setProfilePic(compressedDataUrl);
          setError(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setProfilePic('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = displayName.trim();
    const trimmedUsername = username.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }

    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
      setError('Username can only contain letters, numbers, periods, underscores, and hyphens.');
      return;
    }

    setIsSaving(true);

    try {
      const genderToSave = user.gender ? user.gender : (gender || 'male');
      const storedToken =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('rag_auth_token')
          : null;

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          name: trimmedName,
          username: trimmedUsername,
          gender: genderToSave,
          profilePic: profilePic || '',
        }),
      });

      let data: any = {};
      const responseText = await res.text();
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { error: responseText };
        }
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to update profile (status ${res.status}).`);
      }

      if (data.token && typeof window !== 'undefined') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('rag_auth_token', data.token);
      }

      updateUser(data.user);
      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);

    try {
      const storedToken =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('rag_auth_token')
          : null;

      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      let data: any = {};
      const responseText = await res.text();
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { error: responseText };
        }
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to update password (status ${res.status}).`);
      }

      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordSection(false);
        setPasswordSuccess(null);
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] bg-[#1c1c1f] border border-[#2e2e33] rounded-2xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Title */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium text-white tracking-tight">Edit profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-lg w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative group">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-28 h-28 rounded-full bg-[#9353d3] flex items-center justify-center text-white text-3xl font-medium cursor-pointer overflow-hidden shadow-lg select-none ring-2 ring-white/10 hover:ring-white/25 transition-all"
                title="Change profile photo"
              >
                {profilePic ? (
                  <img
                    src={profilePic}
                    alt={displayName || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{getInitials(displayName || user.name)}</span>
                )}
              </div>

              {/* Camera Icon Overlay Badge */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#18181b] border border-[#3e3e44] text-neutral-300 hover:text-white flex items-center justify-center shadow-md hover:scale-105 transition-all"
                title="Upload photo"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {profilePic && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="mt-2 text-[11px] text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove photo</span>
              </button>
            )}
          </div>

          {/* Display Name Field */}
          <div className="rounded-xl border border-[#38383e] focus-within:border-neutral-400 bg-transparent px-3.5 py-2 transition-colors">
            <label className="block text-[11px] text-neutral-400 font-normal leading-tight">
              Display name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="w-full bg-transparent text-sm text-white focus:outline-none pt-0.5 placeholder-neutral-600"
            />
          </div>

          {/* Username Field */}
          <div className="rounded-xl border border-[#38383e] focus-within:border-neutral-400 bg-transparent px-3.5 py-2 transition-colors">
            <label className="block text-[11px] text-neutral-400 font-normal leading-tight">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
              placeholder="username"
              className="w-full bg-transparent text-sm text-white focus:outline-none pt-0.5 placeholder-neutral-600"
            />
          </div>

          {/* Gender Field: Display only */}
          <div className="rounded-xl border border-[#38383e] bg-transparent px-3.5 py-2">
            <span className="block text-[11px] text-neutral-400 font-normal leading-tight">
              Gender
            </span>
            <div className="text-sm text-white capitalize pt-0.5 select-none">
              {(user.gender || 'male').replace('_', ' ')}
            </div>
          </div>

          {/* Change Password Collapsible Section */}
          <div className="border border-[#38383e] rounded-xl overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => {
                setShowPasswordSection(!showPasswordSection);
                setPasswordError(null);
                setPasswordSuccess(null);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-neutral-900/40 hover:bg-neutral-900/80 text-xs text-neutral-300 font-medium transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-neutral-400" />
                <span>Change password</span>
              </div>
              {showPasswordSection ? (
                <ChevronUp className="w-4 h-4 text-neutral-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              )}
            </button>

            {showPasswordSection && (
              <div className="p-3.5 space-y-3 bg-[#17171a] border-t border-[#38383e]">
                {passwordError && (
                  <div className="p-2.5 bg-red-950/50 border border-red-500/40 rounded-lg text-red-300 text-[11px] flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span>{passwordError}</span>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/40 rounded-lg text-emerald-300 text-[11px] flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#121214] border border-[#38383e] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-neutral-400 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-2.5 top-2 text-neutral-500 hover:text-neutral-300"
                    >
                      {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400">New Password (min 6 chars)</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#121214] border border-[#38383e] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-neutral-400 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-2.5 top-2 text-neutral-500 hover:text-neutral-300"
                    >
                      {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#121214] border border-[#38383e] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-neutral-400"
                  />
                </div>

                <button
                  type="button"
                  disabled={isChangingPassword || !currentPassword || !newPassword}
                  onClick={handleChangePassword}
                  className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  {isChangingPassword ? 'Updating password...' : 'Update Password'}
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full border border-neutral-700 hover:bg-neutral-800/80 text-sm font-medium text-neutral-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-full bg-white text-black hover:bg-neutral-200 text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
