"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Heart, Settings, LogOut, PencilLine, User as UserIcon, Star, Building2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import HeaderClientWrapper from '@/components/layout/HeaderClientWrapper';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { FavoritesError, getMyFavoriteInstitutions, removeFavorite, type FavoriteInstitution } from '@/lib/favorites/favoritesClient';
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

function ProfileSidebar({ user, profile }: { user: SupabaseUser; profile: IndividualProfile | null }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<string>('profile-info');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'favorites') {
        setActiveSection('favorites');
      } else {
        setActiveSection('profile-info');
      }
    };

    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);

    const checkHash = () => {
      handleHashChange();
    };
    
    setTimeout(checkHash, 0);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    
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
  const [favorites, setFavorites] = useState<FavoriteInstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingIds, setActionLoadingIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await getMyFavoriteInstitutions();
        if (cancelled) return;
        setFavorites(list);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof FavoritesError ? err.message : 'Favoriler yüklenemedi. Lütfen tekrar deneyin.';
        setError(msg);
        setFavorites([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemove = async (institutionId: number) => {
    if (actionLoadingIds.has(institutionId)) return;
    setActionLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(institutionId);
      return next;
    });
    const prev = favorites;
    setFavorites((cur) => cur.filter((i) => i.id !== institutionId));
    try {
      await removeFavorite(institutionId);
    } catch (err) {
      setFavorites(prev);
      const msg =
        err instanceof FavoritesError ? err.message : 'Favorilerden kaldırılamadı. Lütfen tekrar deneyin.';
      setError(msg);
      window.alert(msg);
    } finally {
      setActionLoadingIds((prevSet) => {
        const next = new Set(prevSet);
        next.delete(institutionId);
        return next;
      });
    }
  };

  return (
    <section className="favorites-section">
      <div className="favorites-section-header">
        <div className="favorites-section-header-left">
          <Heart className="favorites-section-icon" />
          <h2 className="favorites-section-title">Favoriler</h2>
        </div>
      </div>

      <div className="favorites-section-grid">
        {loading ? (
          <Card className="favorite-card">
            <CardContent className="favorite-card-content">
              <div className="favorite-card-body">
                <p className="favorite-card-description">Favoriler yükleniyor…</p>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="favorite-card">
            <CardContent className="favorite-card-content">
              <div className="favorite-card-body">
                <p className="favorite-card-description">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : favorites.length === 0 ? (
          <Card className="favorite-card">
            <CardContent className="favorite-card-content">
              <div className="favorite-card-body">
                <p className="favorite-card-description">Henüz favori kurum eklemediniz.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          favorites.map((inst) => {
            const title = inst.institution_name ?? 'Kurum';
            const desc = inst.address || inst.about || `${inst.city ?? ''}${inst.district ? ` / ${inst.district}` : ''}` || '—';
            const category = (inst.type ?? '').trim();
            const city = (inst.city ?? '').trim();
            const district = (inst.district ?? '').trim();
            const locationLabel = [city, district].filter(Boolean).join(' / ');
            return (
              <Card key={inst.id} className="favorite-card">
                <CardContent className="favorite-card-content">
                  <div className="favorite-card-image-wrapper">
                    {inst.logo ? (
                      <img src={inst.logo} alt={title} className="favorite-card-logo" />
                    ) : (
                      <div className="favorite-card-placeholder" aria-label="Logo bulunmuyor">
                        <Building2 size={28} />
                      </div>
                    )}
                    {locationLabel && <div className="favorite-card-badge">{locationLabel}</div>}
                    <button
                      type="button"
                      className="favorite-card-remove"
                      aria-label="Favorilerden kaldır"
                      disabled={actionLoadingIds.has(inst.id)}
                      onClick={() => handleRemove(inst.id)}
                    >
                      <Heart className="favorite-card-remove-icon" />
                    </button>
                  </div>
                  <div className="favorite-card-body">
                    <h3 className="favorite-card-title">{title}</h3>
                    {category && <div className="favorite-card-category-inline">{category}</div>}
                    <p className="favorite-card-description">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [usersRow, setUsersRow] = useState<UsersRow | null>(null);
  const [profile, setProfile] = useState<IndividualProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth: same Supabase browser client as header; only redirect when isAuthReady && !user
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setIsAuthReady(true);
    }

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Redirect only after auth is ready and we're sure there is no session (double-check before redirect to avoid race)
  useEffect(() => {
    if (!isAuthReady || user !== null) return;

    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        setUser(session.user);
      } else {
        router.replace('/login');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user, router]);

  // Load profile data when user is set
  useEffect(() => {
    if (!user) return;

    const supabase = createSupabaseBrowserClient();

    const loadProfile = async () => {
      try {
        const { data: userData, error: userDataError } = await supabase
          .from('users')
          .select('id, user_type, auth_user_id, email, first_name, last_name')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        let resolvedUsersRow: UsersRow | null = userDataError ? null : userData;
        setUsersRow(resolvedUsersRow);

        if (resolvedUsersRow?.id) {
          const { data: profileData, error: profileError } = await supabase
            .from('individual_profiles')
            .select('user_id, name, surname, email, birth_date')
            .eq('user_id', resolvedUsersRow.id)
            .maybeSingle();

          setProfile(profileError ? null : profileData);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    loadProfile();
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log('Profile gate:', { isAuthReady, userId: user?.id });
  }, [isAuthReady, user?.id]);

  // Do not redirect while auth is not ready; show skeleton
  if (!isAuthReady || (user && loading)) {
    return (
      <div className="profile-page">
        <HeaderClientWrapper />
        <div className="profile-page-loading">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // After ready: if no user, redirect runs above; avoid flash by not rendering content
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
