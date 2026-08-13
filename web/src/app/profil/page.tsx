"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Heart, Settings, LogOut, PencilLine, User as UserIcon, Star, Building2, X, FileText } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { resolveInstitutionLogoPublicUrl } from '@/lib/institutionHelpers';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { HeaderClientWrapper } from '@/components/layout/header.client';
import { ChangePasswordCard } from '@/components/settings/ChangePasswordCard';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import {
  FavoritesError,
  getMyFavoriteInstitutions,
  getMyFavoriteInstructors,
  removeFavorite,
  removeInstructorFavorite,
  type FavoriteInstitution,
  type FavoriteInstructor,
} from '@/lib/favorites/favoritesClient';
import { UserBlogPostsPanel } from '@/components/blog/UserBlogPostsPanel';
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
  phone: string | null;
  city: string | null;
  age: number | null;
  bio: string | null;
  birth_date: string | null;
}

type ProfileSectionId = 'profile-info' | 'favorites' | 'my-blogs' | 'settings';

function resolveProfileSectionFromHash(hash: string): ProfileSectionId {
  if (hash === 'favorites') return 'favorites';
  if (hash === 'my-blogs') return 'my-blogs';
  if (hash === 'settings') return 'settings';
  return 'profile-info';
}

function resolveIndividualAuthorFullName(
  user: SupabaseUser,
  profile: IndividualProfile | null,
  usersRow: UsersRow | null
): string {
  const profileName = [profile?.name, profile?.surname]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (profileName) return profileName;

  const usersName = [usersRow?.first_name, usersRow?.last_name]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (usersName) return usersName;

  return user.email?.split('@')[0] || 'Kullanıcı';
}

function ProfileSidebar({
  user,
  profile,
  usersRow,
  activeSection,
}: {
  user: SupabaseUser;
  profile: IndividualProfile | null;
  usersRow: UsersRow | null;
  activeSection: ProfileSectionId;
}) {

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    
    window.location.href = '/';
  };

  const fullName = resolveIndividualAuthorFullName(user, profile, usersRow);
  const showMyBlogsTab = usersRow?.user_type === 'individual';

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
          {showMyBlogsTab ? (
            <a
              href="#my-blogs"
              className={`profile-sidebar-nav-item ${activeSection === 'my-blogs' ? 'profile-sidebar-nav-item--active' : ''}`}
            >
              <FileText className="profile-sidebar-nav-icon" />
              <span>Blog Yazılarım</span>
            </a>
          ) : null}
          <a 
            href="#settings" 
            className={`profile-sidebar-nav-item ${activeSection === 'settings' ? 'profile-sidebar-nav-item--active' : ''}`}
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

function ProfileInfoCard({
  user,
  profile,
  usersRowId,
  onProfileUpdated,
}: {
  user: SupabaseUser;
  profile: IndividualProfile | null;
  usersRowId: number | null;
  onProfileUpdated: (next: IndividualProfile) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
    city: '',
    age: '',
  });
  const [initialFormData, setInitialFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    age: '',
  });

  useEffect(() => {
    if (profile || user) {
      setFormData({
        firstName: profile?.name ?? '',
        lastName: profile?.surname ?? '',
        email: profile?.email ?? user?.email ?? '',
        phone: profile?.phone ?? '',
        city: profile?.city ?? '',
        age:
          profile?.age !== null && profile?.age !== undefined
            ? String(profile.age)
            : calculateAge(profile?.birth_date ?? null),
      });
      setInitialFormData({
        firstName: profile?.name ?? '',
        lastName: profile?.surname ?? '',
        email: profile?.email ?? user?.email ?? '',
        phone: profile?.phone ?? '',
        city: profile?.city ?? '',
        age:
          profile?.age !== null && profile?.age !== undefined
            ? String(profile.age)
            : calculateAge(profile?.birth_date ?? null),
      });
      setSaveMessage(null);
    }
  }, [profile, user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEdit = () => {
    setSaveMessage(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    setSaveMessage(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!usersRowId) {
      setSaveMessage('Profil kaydedilemedi.');
      return;
    }

    const parsedAge = formData.age.trim() ? Number(formData.age.trim()) : null;
    if (parsedAge !== null && (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 120)) {
      setSaveMessage('Yaş alanı 0-120 aralığında olmalıdır.');
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    const supabase = createSupabaseBrowserClient();

    try {
      const payload = {
        name: formData.firstName.trim() || null,
        surname: formData.lastName.trim() || null,
        phone: formData.phone.trim() || null,
        city: formData.city.trim() || null,
        age: parsedAge,
      };

      const { data, error } = await supabase
        .from('individual_profiles')
        .update(payload)
        .eq('user_id', usersRowId)
        .select('user_id, name, surname, email, phone, city, age, bio, birth_date')
        .maybeSingle();

      if (error) {
        console.error('Personal profile save error:', error);
        setSaveMessage('Profil kaydedilirken bir hata oluştu.');
        return;
      }

      if (!data) {
        console.error('Personal profile save error: no row returned');
        setSaveMessage('Profil kaydedilemedi.');
        return;
      }

      const nextProfile = data as IndividualProfile;
      onProfileUpdated(nextProfile);
      setSaveMessage('Profil bilgileri güncellendi.');
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="info-card profile-info-card">
      <CardHeader className="profile-info-card-header">
        <div className="profile-info-card-header-left">
          <UserIcon className="profile-info-card-icon" />
          <CardTitle className="profile-info-card-title">Kişisel Bilgiler</CardTitle>
        </div>
        {isEditing ? (
          <div className="profile-info-header-actions">
            <Button
              variant="default"
              className="profile-info-save-btn"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
            <button
              type="button"
              className="profile-info-card-edit-btn"
              aria-label="İptal"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="profile-info-card-edit-icon" />
            </button>
          </div>
        ) : (
          <Button
            variant="default"
            className="profile-info-card-edit-btn"
            onClick={handleEdit}
          >
            <PencilLine className="profile-info-card-edit-icon" />
          </Button>
        )}
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
                disabled
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
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
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

        </div>
        {saveMessage ? (
          <p style={{ marginTop: 12, fontSize: 14, color: '#52525b' }}>{saveMessage}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FavoritesSection() {
  const [favorites, setFavorites] = useState<FavoriteInstitution[]>([]);
  const [instructorFavorites, setInstructorFavorites] = useState<FavoriteInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingIds, setActionLoadingIds] = useState<Set<number>>(() => new Set());
  const [instructorActionLoadingIds, setInstructorActionLoadingIds] = useState<Set<number>>(() => new Set());
  const [brokenLogoIds, setBrokenLogoIds] = useState<Set<number>>(() => new Set());
  const [brokenInstructorImageIds, setBrokenInstructorImageIds] = useState<Set<number>>(() => new Set());

  const normalizedFavorites = useMemo(() => {
    const supabase = createSupabaseBrowserClient();
    return favorites.map((inst) => {
      const logoUrl = resolveInstitutionLogoPublicUrl(supabase, inst.logo);
      return { ...inst, logoUrl: logoUrl || null };
    });
  }, [favorites]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [list, instructorList] = await Promise.all([
          getMyFavoriteInstitutions(),
          getMyFavoriteInstructors(),
        ]);
        if (cancelled) return;
        setFavorites(list);
        setInstructorFavorites(instructorList);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof FavoritesError ? err.message : 'Favoriler yüklenemedi. Lütfen tekrar deneyin.';
        setError(msg);
        setFavorites([]);
        setInstructorFavorites([]);
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

  const handleRemoveInstructor = async (instructorId: number) => {
    if (instructorActionLoadingIds.has(instructorId)) return;
    setInstructorActionLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(instructorId);
      return next;
    });
    const prev = instructorFavorites;
    setInstructorFavorites((cur) => cur.filter((i) => i.id !== instructorId));
    try {
      await removeInstructorFavorite(instructorId);
    } catch (err) {
      setInstructorFavorites(prev);
      const msg =
        err instanceof FavoritesError ? err.message : 'Favorilerden kaldırılamadı. Lütfen tekrar deneyin.';
      setError(msg);
      window.alert(msg);
    } finally {
      setInstructorActionLoadingIds((prevSet) => {
        const next = new Set(prevSet);
        next.delete(instructorId);
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

      {loading ? (
        <div className="favorites-section-grid">
          <Card className="favorite-card">
            <CardContent className="favorite-card-content">
              <div className="favorite-card-body">
                <p className="favorite-card-description">Favoriler yükleniyor…</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        <div className="favorites-section-grid">
          <Card className="favorite-card">
            <CardContent className="favorite-card-content">
              <div className="favorite-card-body">
                <p className="favorite-card-description">{error}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : favorites.length === 0 && instructorFavorites.length === 0 ? (
        <div className="favorites-section-grid">
          <Card className="favorite-card">
            <CardContent className="favorite-card-content">
              <div className="favorite-card-body">
                <p className="favorite-card-description">Henüz favori kurum veya eğitmen eklemediniz.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="favorites-subsection">
            <h3 className="favorites-subsection-title">Favori Kurumlarım</h3>
            {favorites.length === 0 ? (
              <p className="favorites-subsection-empty">Henüz favori kurum eklemediniz.</p>
            ) : (
              <div className="favorites-section-grid">
                {normalizedFavorites.map((inst) => {
                  const title = inst.institution_name ?? 'Kurum';
                  const desc = inst.address || inst.about || `${inst.city ?? ''}${inst.district ? ` / ${inst.district}` : ''}` || '—';
                  const category = (inst.categoryName ?? '').trim();
                  const city = (inst.city ?? '').trim();
                  const district = (inst.district ?? '').trim();
                  const locationLabel = [city, district].filter(Boolean).join(' / ');
                  const canRenderLogo = Boolean(inst.logoUrl) && !brokenLogoIds.has(inst.id);
                  return (
                    <Card key={inst.id} className="favorite-card">
                      <CardContent className="favorite-card-content">
                        <div className="favorite-card-image-wrapper">
                          {canRenderLogo ? (
                            <img
                              src={inst.logoUrl ?? ''}
                              alt={title}
                              className="favorite-card-logo"
                              onError={() =>
                                setBrokenLogoIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(inst.id);
                                  return next;
                                })
                              }
                            />
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
                })}
              </div>
            )}
          </div>

          <div className="favorites-subsection">
            <h3 className="favorites-subsection-title">Favori Eğitmenlerim</h3>
            {instructorFavorites.length === 0 ? (
              <p className="favorites-subsection-empty">Henüz favori eğitmen eklemediniz.</p>
            ) : (
              <div className="favorites-section-grid">
                {instructorFavorites.map((instructor) => {
                  const canRenderImage =
                    Boolean(instructor.profilePictureUrl) && !brokenInstructorImageIds.has(instructor.id);
                  const meta = [instructor.branch, instructor.school].filter(Boolean).join(' · ');
                  return (
                    <Card key={instructor.id} className="favorite-card">
                      <CardContent className="favorite-card-content">
                        <div className="favorite-card-image-wrapper">
                          {canRenderImage ? (
                            <img
                              src={instructor.profilePictureUrl ?? ''}
                              alt={instructor.name}
                              className="favorite-card-logo"
                              onError={() =>
                                setBrokenInstructorImageIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(instructor.id);
                                  return next;
                                })
                              }
                            />
                          ) : (
                            <div className="favorite-card-placeholder" aria-label="Profil fotoğrafı bulunmuyor">
                              <UserIcon size={28} />
                            </div>
                          )}
                          {instructor.location && <div className="favorite-card-badge">{instructor.location}</div>}
                          <button
                            type="button"
                            className="favorite-card-remove"
                            aria-label="Favorilerden kaldır"
                            disabled={instructorActionLoadingIds.has(instructor.id)}
                            onClick={() => handleRemoveInstructor(instructor.id)}
                          >
                            <Heart className="favorite-card-remove-icon" />
                          </button>
                        </div>
                        <div className="favorite-card-body">
                          <h3 className="favorite-card-title">{instructor.name}</h3>
                          {instructor.title ? (
                            <div className="favorite-card-category-inline">{instructor.title}</div>
                          ) : null}
                          <p className="favorite-card-description">
                            {meta || instructor.priceRange || instructor.location || '—'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
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
  const [activeSection, setActiveSection] = useState<ProfileSectionId>('profile-info');
  const userId = user?.id ?? null;

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
        router.replace('/giris');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user, router]);

  // Load profile data when user is set
  useEffect(() => {
    if (!userId) return;

    const supabase = createSupabaseBrowserClient();

    const loadProfile = async () => {
      try {
        const { data: userData, error: userDataError } = await supabase
          .from('users')
          .select('id, user_type, auth_user_id, email, first_name, last_name')
          .eq('auth_user_id', userId)
          .maybeSingle();

        const resolvedUsersRow: UsersRow | null = userDataError ? null : userData;
        setUsersRow(resolvedUsersRow);

        if (resolvedUsersRow?.id) {
          const { data: profileData, error: profileError } = await supabase
            .from('individual_profiles')
            .select('user_id, name, surname, email, phone, city, age, bio, birth_date')
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
  }, [userId]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setActiveSection(resolveProfileSectionFromHash(hash));
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

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
        <ProfileSidebar user={user} profile={profile} usersRow={usersRow} activeSection={activeSection} />
        <div className="profile-page-main">
          {activeSection === 'profile-info' ? (
            <div id="profile-info">
              <ProfileInfoCard
                user={user}
                profile={profile}
                usersRowId={usersRow?.id ?? null}
                onProfileUpdated={setProfile}
              />
            </div>
          ) : null}
          {activeSection === 'favorites' ? (
            <div id="favorites">
              <FavoritesSection />
            </div>
          ) : null}
          {activeSection === 'my-blogs' && usersRow?.user_type === 'individual' ? (
            <div id="my-blogs">
              <UserBlogPostsPanel
                authorType="individual"
                authorAuthId={user.id}
                authorFullName={resolveIndividualAuthorFullName(user, profile, usersRow)}
              />
            </div>
          ) : null}
          {activeSection === 'settings' ? (
            <div id="settings">
              <ChangePasswordCard />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
