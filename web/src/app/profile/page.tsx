"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Heart, Settings, LogOut, PencilLine, User as UserIcon, Star } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import HeaderClientWrapper from '@/components/layout/HeaderClientWrapper';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import '@/styles/main.scss';
import '@/styles/pages/profile.scss';

interface UsersRow {
  id: number;
  user_type: string | null;
  auth_user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface IndividualProfile {
  user_id: number;
  name: string | null;
  surname: string | null;
  email: string | null;
  birth_date: string | null;
}

interface FavoriteItem {
  id: string;
  type: 'school' | 'course';
  title: string;
  description: string;
  imageUrl?: string;
  logoUrl?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  tags?: string[];
}

const mockFavorites: FavoriteItem[] = [
  {
    id: '1',
    type: 'course',
    title: 'UI/UX Tasarım Temelleri',
    description: 'Kullanıcı arayüzü tasarımının temel prensiplerini öğrenin.',
    imageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=300&fit=crop',
    rating: 4.8,
    reviewCount: 124,
    category: 'Tasarım',
  },
  {
    id: '2',
    type: 'course',
    title: 'İleri Seviye JavaScript',
    description: 'Modern JS teknikleri ve asenkron programlama.',
    imageUrl: 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=400&h=300&fit=crop',
    rating: 4.9,
    reviewCount: 86,
    category: 'Yazılım',
  },
  {
    id: '3',
    type: 'school',
    title: 'MIT OpenCourseWare',
    description: 'Dünyanın en iyi teknik üniversitelerinden biri.',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/MIT_logo.svg',
    category: 'Teknoloji',
    tags: ['Teknoloji', 'Bilim'],
  },
  {
    id: '4',
    type: 'school',
    title: 'Harvard Online',
    description: 'Liderlik ve işletme alanında uzmanlaşın.',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Harvard_University_logo.svg',
    category: 'İşletme',
    tags: ['İşletme', 'Liderlik'],
  },
];

function ProfileSidebar({ user, profile }: { user: SupabaseUser; profile: IndividualProfile | null }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<string>('profile-info');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'favorites') {
        setActiveSection('favorites');
      } else {
        // Default to profile-info if no hash or hash is profile-info
        setActiveSection('profile-info');
      }
    };

    // Set initial active section based on hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    // Also check on mount in case hash is already set
    const checkHash = () => {
      handleHashChange();
    };
    
    // Small delay to ensure hash is set
    setTimeout(checkHash, 0);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    
    // Ana sayfaya yönlendir
    window.location.href = '/';
  };

  const fullName = profile?.name && profile?.surname
    ? `${profile.name} ${profile.surname}`
    : user.email?.split('@')[0] || 'Kullanıcı';

  return (
    <aside className="profile-sidebar">
      <div className="profile-sidebar-content">
        <div className="profile-sidebar-avatar">
          <div className="profile-sidebar-avatar-placeholder">
            {fullName.charAt(0).toUpperCase()}
          </div>
        </div>
        <h2 className="profile-sidebar-name">{fullName}</h2>

        <nav className="profile-sidebar-nav">
          <a 
            href="#profile-info" 
            className={`profile-sidebar-nav-item ${activeSection === 'profile-info' ? 'profile-sidebar-nav-item--active' : ''}`}
          >
            <User className="profile-sidebar-nav-icon" />
            <span>Profil Bilgileri</span>
          </a>
          <a 
            href="#favorites" 
            className={`profile-sidebar-nav-item ${activeSection === 'favorites' ? 'profile-sidebar-nav-item--active' : ''}`}
          >
            <Heart className="profile-sidebar-nav-icon" />
            <span>Favorilerim</span>
          </a>
          <a 
            href="#settings" 
            className="profile-sidebar-nav-item"
          >
            <Settings className="profile-sidebar-nav-icon" />
            <span>Ayarlar</span>
          </a>
          <a 
            href="#" 
            className="profile-sidebar-nav-item profile-sidebar-nav-item--logout" 
            onClick={(e) => {
              e.preventDefault();
              handleLogout();
            }}
          >
            <LogOut className="profile-sidebar-nav-icon" />
            <span>Çıkış Yap</span>
          </a>
        </nav>
      </div>
    </aside>
  );
}

function ProfileInfoCard({ user, profile }: { user: SupabaseUser; profile: IndividualProfile | null }) {
  const [isEditing, setIsEditing] = useState(false);

  const calculateAge = (birthDate: string | null): string => {
    if (!birthDate) return '';
    try {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return String(age);
    } catch {
      return '';
    }
  };

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    cityCountry: '',
    age: '',
    about: '',
  });

  useEffect(() => {
    if (profile || user) {
      setFormData({
        firstName: profile?.name ?? '',
        lastName: profile?.surname ?? '',
        email: profile?.email ?? user?.email ?? '',
        phone: '',
        cityCountry: '',
        age: calculateAge(profile?.birth_date ?? null),
        about: '',
      });
    }
  }, [profile, user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEdit = () => {
    setIsEditing(!isEditing);
  };

  return (
    <Card className="info-card profile-info-card">
      <CardHeader className="profile-info-card-header">
        <div className="profile-info-card-header-left">
          <UserIcon className="profile-info-card-icon" />
          <CardTitle className="profile-info-card-title">Kişisel Bilgiler</CardTitle>
        </div>
        <Button
          variant="default"
          className="profile-info-card-edit-btn"
          onClick={handleEdit}
        >
          <PencilLine className="profile-info-card-edit-icon" />
        </Button>
      </CardHeader>
      <CardContent className="profile-info-card-content">
        <div className="profile-info-form">
          <div className="profile-info-form-row">
            <div className="profile-info-form-field">
              <label className="profile-info-form-label">AD</label>
              <Input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                disabled={!isEditing}
                className="profile-info-form-input"
              />
            </div>
            <div className="profile-info-form-field">
              <label className="profile-info-form-label">SOYAD</label>
              <Input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                disabled={!isEditing}
                className="profile-info-form-input"
              />
            </div>
          </div>

          <div className="profile-info-form-row">
            <div className="profile-info-form-field">
              <label className="profile-info-form-label">E-POSTA</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={!isEditing}
                className="profile-info-form-input"
              />
            </div>
            <div className="profile-info-form-field">
              <label className="profile-info-form-label">TELEFON</label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                disabled={!isEditing}
                className="profile-info-form-input"
              />
            </div>
          </div>

          <div className="profile-info-form-row">
            <div className="profile-info-form-field">
              <label className="profile-info-form-label">ŞEHİR</label>
              <Input
                type="text"
                value={formData.cityCountry}
                onChange={(e) => handleInputChange('cityCountry', e.target.value)}
                disabled={!isEditing}
                className="profile-info-form-input"
              />
            </div>
            <div className="profile-info-form-field">
              <label className="profile-info-form-label">YAŞ</label>
              <Input
                type="number"
                value={formData.age}
                onChange={(e) => handleInputChange('age', e.target.value)}
                disabled={!isEditing}
                className="profile-info-form-input"
                min="0"
                max="120"
              />
            </div>
          </div>

          <div className="profile-info-form-row profile-info-form-row--full">
            <div className="profile-info-form-field">
              <label className="profile-info-form-label">HAKKINDA</label>
              <textarea
                value={formData.about}
                onChange={(e) => handleInputChange('about', e.target.value)}
                disabled={!isEditing}
                className="profile-info-form-textarea"
                rows={4}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FavoritesSection() {
  const [activeTab, setActiveTab] = useState<'schools' | 'courses'>('courses');

  const filteredFavorites = mockFavorites.filter(item => {
    if (activeTab === 'schools') {
      return item.type === 'school';
    }
    return item.type === 'course';
  });

  return (
    <section className="favorites-section">
      <div className="favorites-section-header">
        <div className="favorites-section-header-left">
          <Heart className="favorites-section-icon" />
          <h2 className="favorites-section-title">Favoriler</h2>
        </div>
        <div className="favorites-section-tabs">
          <button
            className={`favorites-section-tab ${activeTab === 'schools' ? 'favorites-section-tab--active' : ''}`}
            onClick={() => setActiveTab('schools')}
          >
            Okullar
          </button>
          <button
            className={`favorites-section-tab ${activeTab === 'courses' ? 'favorites-section-tab--active' : ''}`}
            onClick={() => setActiveTab('courses')}
          >
            Kurslar
          </button>
        </div>
      </div>

      <div className="favorites-section-grid">
        {filteredFavorites.map((item) => (
          <Card key={item.id} className="favorite-card">
            <CardContent className="favorite-card-content">
              <div className="favorite-card-image-wrapper">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="favorite-card-image"
                  />
                ) : item.logoUrl ? (
                  <img
                    src={item.logoUrl}
                    alt={item.title}
                    className="favorite-card-logo"
                  />
                ) : (
                  <div className="favorite-card-placeholder" />
                )}
                <div className="favorite-card-badge">
                  {item.type === 'school' ? 'OKUL' : 'KURS'}
                </div>
                {item.category && (
                  <div className="favorite-card-category">{item.category}</div>
                )}
              </div>
              <div className="favorite-card-body">
                <h3 className="favorite-card-title">{item.title}</h3>
                <p className="favorite-card-description">{item.description}</p>
                {item.rating && (
                  <div className="favorite-card-rating">
                    <Star className="favorite-card-rating-icon" />
                    <span className="favorite-card-rating-value">
                      {item.rating} ({item.reviewCount} Değerlendirme)
                    </span>
                  </div>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="favorite-card-tags">
                    {item.tags.map((tag, index) => (
                      <span key={index} className="favorite-card-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [usersRow, setUsersRow] = useState<UsersRow | null>(null);
  const [profile, setProfile] = useState<IndividualProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const loadProfile = async () => {
      try {
        // A) Auth check
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !currentUser) {
          router.push('/login');
          return;
        }

        setUser(currentUser);

        // B) Read users row (SELECT only)
        const { data: userData, error: userDataError } = await supabase
          .from('users')
          .select('id, user_type, auth_user_id, email, first_name, last_name')
          .eq('auth_user_id', currentUser.id)
          .maybeSingle();

        let resolvedUsersRow: UsersRow | null = null;

        if (userDataError) {
          // RLS or other error - continue safely
          console.warn('Users table query error:', userDataError.message);
        } else {
          resolvedUsersRow = userData;
        }

        console.log({ authUserId: currentUser.id, usersRow: userData, usersError: userDataError });

        setUsersRow(resolvedUsersRow);

        // D) Read individual_profiles row (SELECT only)
        if (resolvedUsersRow?.id) {
          const { data: profileData, error: profileError } = await supabase
            .from('individual_profiles')
            .select('user_id, name, surname, email, birth_date')
            .eq('user_id', resolvedUsersRow.id)
            .maybeSingle();

          console.log({ usersId: resolvedUsersRow?.id, profileRow: profileData, profileError });

          if (profileError) {
            // RLS or other error - continue safely
            console.warn('Individual profiles query error:', profileError.message);
            setProfile(null);
          } else {
            setProfile(profileData);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        // Do not redirect on error, just keep UI empty
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="profile-page">
        <HeaderClientWrapper />
        <div className="profile-page-loading">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="profile-page">
      <HeaderClientWrapper />
      <div className="profile-page-container">
        <ProfileSidebar user={user} profile={profile} />
        <div className="profile-page-main">
          <div id="profile-info">
            <ProfileInfoCard user={user} profile={profile} />
          </div>
          <div id="favorites">
            <FavoritesSection />
          </div>
        </div>
      </div>
    </div>
  );
}
