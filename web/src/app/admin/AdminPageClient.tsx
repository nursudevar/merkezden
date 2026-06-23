"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  LogOut,
  Megaphone,
  Settings,
  Shield,
  User,
  Users,
  BookOpenText,
  PencilLine,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { Card, CardContent } from "@/components/ui";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildProfileSearchVariants,
  escapeProfileLikeValue,
  resolveInstitutionIdsByProfileSearch,
  resolveInstructorIdsByProfileSearch,
} from "@/lib/profileSearch";
import "@/styles/main.scss";
import "@/styles/components/app-modal.scss";
import "@/styles/pages/admin.scss";

type AdminTabId =
  | "overview"
  | "institutions"
  | "users"
  | "instructors"
  | "announcements"
  | "blog-posts"
  | "settings";

type AdminMetricCard = {
  id: "users" | "institutions" | "announcements" | "instructors";
  title: string;
  icon: React.ReactNode;
  value: number | null;
  note?: string | null;
  loading: boolean;
  error: string | null;
};

type InstitutionListRow = {
  id: number;
  institution_name: string | null;
  type: string | null;
  district: string | null;
  institution_type?: {
    name?: string | null;
    category?: { name?: string | null } | null;
  } | null;
};

const INSTITUTIONS_PAGE_SIZE = 10;
const INDIVIDUAL_USERS_PAGE_SIZE = 10;
const INSTRUCTORS_PAGE_SIZE = 10;
const ANNOUNCEMENTS_PAGE_SIZE = 10;
const BLOG_POSTS_PAGE_SIZE = 10;

type IndividualUserListRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  auth_user_id: string | null;
  is_email_verified: boolean | null;
  phone: string | null;
  profile_name: string | null;
  profile_surname: string | null;
};

type AdminRoleIdentifiers = {
  authUserIds: string[];
  userIds: number[];
};

type IndividualUserEditForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type InstructorListRow = {
  id: number;
  name: string | null;
  surname: string | null;
  email: string | null;
  phone: string | null;
  branch: string | null;
  district: string | null;
};

type InstructorEditForm = {
  name: string;
  surname: string;
  email: string;
  phone: string;
  branch: string;
  district: string;
};

type AnnouncementListRow = {
  id: string;
  title: string | null;
  content: string | null;
  announcement_image_url: string | null;
  link_url: string | null;
  created_at: string | null;
  is_active: boolean | null;
};

type AnnouncementEditForm = {
  title: string;
  content: string;
  announcementImageUrl: string;
  linkUrl: string;
  isActive: boolean;
};

type BlogPostListRow = {
  id: string;
  title: string | null;
  content: string | null;
  author_full_name: string | null;
  author_type: string | null;
  category_id: number | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  is_published: boolean | null;
  published_at: string | null;
  created_at: string | null;
  category?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type BlogCategoryOption = {
  id: number;
  name: string;
};

type BlogPostEditForm = {
  title: string;
  content: string;
  categoryId: string;
  coverImageUrl: string;
  isPublished: boolean;
};

type DeleteConfirmTarget =
  | { type: "individual-user"; id: number }
  | { type: "institution"; id: number }
  | { type: "instructor"; id: number }
  | { type: "announcement"; id: string }
  | { type: "blog-post"; id: string };

async function fetchAdminRoleIdentifiers(
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): Promise<AdminRoleIdentifiers> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("auth_user_id, user_id")
    .eq("role", "admin");

  const authUserIds = new Set<string>();
  const userIds = new Set<number>();

  if (!error && Array.isArray(data)) {
    for (const row of data) {
      if (row.auth_user_id) authUserIds.add(String(row.auth_user_id));
      const userId = Number(row.user_id);
      if (Number.isFinite(userId)) userIds.add(userId);
    }
  }

  return {
    authUserIds: Array.from(authUserIds),
    userIds: Array.from(userIds),
  };
}

function cleanIndividualUserPhoneInput(value: string): string {
  return value.replace(/[^\d\s+()-]/g, "");
}

function isValidIndividualUserPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function useAdminModalBackdropClose() {
  const pointerDownOnBackdropRef = useRef(false);

  const onBackdropPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pointerDownOnBackdropRef.current = event.target === event.currentTarget;
  }, []);

  const getBackdropClickHandler = useCallback((onClose: () => void) => {
    return (event: React.MouseEvent<HTMLDivElement>) => {
      if (pointerDownOnBackdropRef.current && event.target === event.currentTarget) {
        onClose();
      }
      pointerDownOnBackdropRef.current = false;
    };
  }, []);

  return { onBackdropPointerDown, getBackdropClickHandler };
}

function formatAnnouncementDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
}

function buildAnnouncementContentPreview(content: string | null, maxLength = 80): string {
  const normalized = String(content ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "-";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function resolveBlogCategoryName(
  category: BlogPostListRow["category"]
): string {
  const categoryRow = Array.isArray(category) ? category[0] : category;
  return String(categoryRow?.name ?? "").trim() || "-";
}

function resolveBlogAuthorTypeLabel(authorType: string | null): string {
  if (authorType === "instructor") return "Eğitmen";
  if (authorType === "individual") return "Bireysel Kullanıcı";
  return "-";
}

function formatBlogPostAdminDate(publishedAt: string | null, createdAt: string | null): string {
  return formatAnnouncementDate(publishedAt ?? createdAt);
}

function resolveInstructorFullName(row: InstructorListRow): string {
  const fullName = [row.name, row.surname]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;
  return String(row.email ?? "").trim() || "-";
}

function resolveIndividualUserFullName(row: IndividualUserListRow): string {
  const profileName = [row.profile_name, row.profile_surname]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (profileName) return profileName;

  const usersName = [row.first_name, row.last_name]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (usersName) return usersName;

  return String(row.email ?? "").trim() || "-";
}

export default function AdminPageClient() {
  const router = useRouter();
  const { onBackdropPointerDown, getBackdropClickHandler } = useAdminModalBackdropClose();
  const [activeTab, setActiveTab] = useState<AdminTabId>("overview");

  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [institutionsCount, setInstitutionsCount] = useState<number | null>(null);
  const [announcementsCount, setAnnouncementsCount] = useState<number | null>(null);
  const [instructorsCount, setInstructorsCount] = useState<number | null>(null);

  const [usersLoading, setUsersLoading] = useState(true);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [instructorsLoading, setInstructorsLoading] = useState(true);

  const [usersError, setUsersError] = useState<string | null>(null);
  const [institutionsError, setInstitutionsError] = useState<string | null>(null);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [instructorsError, setInstructorsError] = useState<string | null>(null);
  const [institutionsList, setInstitutionsList] = useState<InstitutionListRow[]>([]);
  const [institutionsListLoading, setInstitutionsListLoading] = useState(false);
  const [institutionsListError, setInstitutionsListError] = useState<string | null>(null);
  const [institutionsPage, setInstitutionsPage] = useState(1);
  const [institutionsPageInput, setInstitutionsPageInput] = useState("1");
  const [institutionsSearchInput, setInstitutionsSearchInput] = useState("");
  const [institutionsSearchQuery, setInstitutionsSearchQuery] = useState("");
  const [institutionsTotalCount, setInstitutionsTotalCount] = useState(0);
  const [mediaCountByInstitutionId, setMediaCountByInstitutionId] = useState<Record<number, number>>({});
  const [deletingInstitutionId, setDeletingInstitutionId] = useState<number | null>(null);
  const [institutionsReloadKey, setInstitutionsReloadKey] = useState(0);

  const [individualUsersList, setIndividualUsersList] = useState<IndividualUserListRow[]>([]);
  const [individualUsersListLoading, setIndividualUsersListLoading] = useState(false);
  const [individualUsersListError, setIndividualUsersListError] = useState<string | null>(null);
  const [individualUsersPage, setIndividualUsersPage] = useState(1);
  const [individualUsersPageInput, setIndividualUsersPageInput] = useState("1");
  const [individualUsersSearchInput, setIndividualUsersSearchInput] = useState("");
  const [individualUsersSearchQuery, setIndividualUsersSearchQuery] = useState("");
  const [individualUsersTotalCount, setIndividualUsersTotalCount] = useState(0);
  const [deletingIndividualUserId, setDeletingIndividualUserId] = useState<number | null>(null);
  const [individualUsersReloadKey, setIndividualUsersReloadKey] = useState(0);
  const [editingIndividualUser, setEditingIndividualUser] = useState<IndividualUserListRow | null>(
    null
  );
  const [individualUserEditForm, setIndividualUserEditForm] = useState<IndividualUserEditForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [individualUserEditSaving, setIndividualUserEditSaving] = useState(false);
  const [individualUserEditError, setIndividualUserEditError] = useState<string | null>(null);
  const [individualUserEditPhoneError, setIndividualUserEditPhoneError] = useState<string | null>(
    null
  );
  const [instructorsList, setInstructorsList] = useState<InstructorListRow[]>([]);
  const [instructorsListLoading, setInstructorsListLoading] = useState(false);
  const [instructorsListError, setInstructorsListError] = useState<string | null>(null);
  const [instructorsPage, setInstructorsPage] = useState(1);
  const [instructorsPageInput, setInstructorsPageInput] = useState("1");
  const [instructorsSearchInput, setInstructorsSearchInput] = useState("");
  const [instructorsSearchQuery, setInstructorsSearchQuery] = useState("");
  const [instructorsTotalCount, setInstructorsTotalCount] = useState(0);
  const [deletingInstructorId, setDeletingInstructorId] = useState<number | null>(null);
  const [instructorsReloadKey, setInstructorsReloadKey] = useState(0);
  const [editingInstructor, setEditingInstructor] = useState<InstructorListRow | null>(null);
  const [instructorEditForm, setInstructorEditForm] = useState<InstructorEditForm>({
    name: "",
    surname: "",
    email: "",
    phone: "",
    branch: "",
    district: "",
  });
  const [instructorEditSaving, setInstructorEditSaving] = useState(false);
  const [instructorEditError, setInstructorEditError] = useState<string | null>(null);
  const [instructorEditPhoneError, setInstructorEditPhoneError] = useState<string | null>(null);
  const [announcementsList, setAnnouncementsList] = useState<AnnouncementListRow[]>([]);
  const [announcementsListLoading, setAnnouncementsListLoading] = useState(false);
  const [announcementsListError, setAnnouncementsListError] = useState<string | null>(null);
  const [announcementsPage, setAnnouncementsPage] = useState(1);
  const [announcementsPageInput, setAnnouncementsPageInput] = useState("1");
  const [announcementsSearchInput, setAnnouncementsSearchInput] = useState("");
  const [announcementsSearchQuery, setAnnouncementsSearchQuery] = useState("");
  const [announcementsTotalCount, setAnnouncementsTotalCount] = useState(0);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);
  const [announcementsReloadKey, setAnnouncementsReloadKey] = useState(0);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementListRow | null>(null);
  const [announcementEditForm, setAnnouncementEditForm] = useState<AnnouncementEditForm>({
    title: "",
    content: "",
    announcementImageUrl: "",
    linkUrl: "",
    isActive: true,
  });
  const [announcementEditSaving, setAnnouncementEditSaving] = useState(false);
  const [announcementEditError, setAnnouncementEditError] = useState<string | null>(null);
  const [blogPostsList, setBlogPostsList] = useState<BlogPostListRow[]>([]);
  const [blogPostsListLoading, setBlogPostsListLoading] = useState(false);
  const [blogPostsListError, setBlogPostsListError] = useState<string | null>(null);
  const [blogPostsPage, setBlogPostsPage] = useState(1);
  const [blogPostsPageInput, setBlogPostsPageInput] = useState("1");
  const [blogPostsSearchInput, setBlogPostsSearchInput] = useState("");
  const [blogPostsSearchQuery, setBlogPostsSearchQuery] = useState("");
  const [blogPostsTotalCount, setBlogPostsTotalCount] = useState(0);
  const [blogPostsReloadKey, setBlogPostsReloadKey] = useState(0);
  const [deletingBlogPostId, setDeletingBlogPostId] = useState<string | null>(null);
  const [editingBlogPost, setEditingBlogPost] = useState<BlogPostListRow | null>(null);
  const [blogPostEditForm, setBlogPostEditForm] = useState<BlogPostEditForm>({
    title: "",
    content: "",
    categoryId: "",
    coverImageUrl: "",
    isPublished: true,
  });
  const [blogPostEditSaving, setBlogPostEditSaving] = useState(false);
  const [blogPostEditError, setBlogPostEditError] = useState<string | null>(null);
  const [blogCategoryOptions, setBlogCategoryOptions] = useState<BlogCategoryOption[]>([]);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<DeleteConfirmTarget | null>(null);
  const [deleteConfirmError, setDeleteConfirmError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const loadCount = async (
      table: string,
      onSuccess: (count: number) => void,
      onError: () => void,
      onDone: () => void
    ) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (cancelled) return;
      if (error) {
        onError();
      } else {
        onSuccess(count ?? 0);
      }
      onDone();
    };

    (async () => {
      const { count, error } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("user_type", "individual");

      if (cancelled) return;

      if (error) {
        setUsersCount(null);
        setUsersError("Bireysel kullanıcı sayısı alınamadı.");
      } else {
        setUsersCount(count ?? 0);
        setUsersError(null);
      }
      setUsersLoading(false);
    })();

    void loadCount(
      "institutions",
      (count) => {
        setInstitutionsCount(count);
        setInstitutionsError(null);
      },
      () => {
        setInstitutionsCount(null);
        setInstitutionsError("Kurum sayısı alınamadı.");
      },
      () => setInstitutionsLoading(false)
    );

    void loadCount(
      "announcements",
      (count) => {
        setAnnouncementsCount(count);
        setAnnouncementsError(null);
      },
      () => {
        setAnnouncementsCount(null);
        setAnnouncementsError("Duyuru sayısı alınamadı.");
      },
      () => setAnnouncementsLoading(false)
    );

    void loadCount(
      "instructors",
      (count) => {
        setInstructorsCount(count);
        setInstructorsError(null);
      },
      () => {
        setInstructorsCount(null);
        setInstructorsError("Bireysel eğitmen sayısı alınamadı.");
      },
      () => setInstructorsLoading(false)
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const metrics: AdminMetricCard[] = [
    {
      id: "users",
      title: "Bireysel Kullanıcılar",
      icon: <Users className="admin-overview-metric-icon" aria-hidden />,
      value: usersCount,
      loading: usersLoading,
      error: usersError,
    },
    {
      id: "institutions",
      title: "Kurumlar",
      icon: <Building2 className="admin-overview-metric-icon" aria-hidden />,
      value: institutionsCount,
      loading: institutionsLoading,
      error: institutionsError,
    },
    {
      id: "announcements",
      title: "Duyurular",
      icon: <Megaphone className="admin-overview-metric-icon" aria-hidden />,
      value: announcementsCount,
      loading: announcementsLoading,
      error: announcementsError,
    },
    {
      id: "instructors",
      title: "Eğitmenler",
      icon: <User className="admin-overview-metric-icon" aria-hidden />,
      value: instructorsCount,
      loading: instructorsLoading,
      error: instructorsError,
    },
  ];

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  useEffect(() => {
    if (activeTab !== "institutions") return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const loadInstitutionsPage = async () => {
      setInstitutionsListLoading(true);
      setInstitutionsListError(null);

      const from = (institutionsPage - 1) * INSTITUTIONS_PAGE_SIZE;
      const to = from + INSTITUTIONS_PAGE_SIZE - 1;

      let institutionsQuery = supabase
        .from("institutions")
        .select(
          "id, institution_name, type, district, institution_type:institution_types(name, category:institution_categories(name))",
          { count: "exact" }
        )
        .order("id", { ascending: false });

      const normalizedSearch = institutionsSearchQuery.trim();
      if (normalizedSearch.length > 0) {
        const relatedSearch = await resolveInstitutionIdsByProfileSearch(supabase, normalizedSearch);
        const variants = buildProfileSearchVariants(normalizedSearch).map(escapeProfileLikeValue).filter(Boolean);
        const searchColumns = [
          "institution_name",
          "type",
          "subheading",
          "about",
          "city",
          "district",
          "address",
          "official_phone",
          "official_email",
          "website",
          "facebook_url",
          "instagram_url",
          "x_url",
          "linkedin_url",
        ] as const;
        const orParts = variants.flatMap((term) => {
          const q = `%${term}%`;
          return searchColumns.map((col) => `${col}.ilike.${q}`);
        });
        if (relatedSearch.institutionIds.length > 0) {
          orParts.push(`id.in.(${relatedSearch.institutionIds.join(",")})`);
        }
        if (relatedSearch.institutionTypeIds.length > 0) {
          orParts.push(`institution_type_id.in.(${relatedSearch.institutionTypeIds.join(",")})`);
        }
        if (orParts.length > 0) {
          institutionsQuery = institutionsQuery.or(orParts.join(","));
        }
      }

      const { data, count, error } = await institutionsQuery.range(from, to);

      if (cancelled) return;

      if (error) {
        setInstitutionsList([]);
        setInstitutionsTotalCount(0);
        setMediaCountByInstitutionId({});
        setInstitutionsListError("Kurum listesi alınamadı.");
        setInstitutionsListLoading(false);
        return;
      }

      const rows = (data ?? []) as InstitutionListRow[];
      setInstitutionsList(rows);
      setInstitutionsTotalCount(count ?? 0);

      const ids = rows.map((row) => row.id).filter((id) => Number.isFinite(id));
      if (ids.length === 0) {
        setMediaCountByInstitutionId({});
        setInstitutionsListLoading(false);
        return;
      }

      const { data: mediaRows, error: mediaError } = await supabase
        .from("institution_media")
        .select("institution_id")
        .in("institution_id", ids);

      if (cancelled) return;

      if (mediaError) {
        setMediaCountByInstitutionId({});
      } else {
        const counts: Record<number, number> = {};
        (mediaRows ?? []).forEach((row: { institution_id: number | null }) => {
          const institutionId = Number(row.institution_id);
          if (!Number.isFinite(institutionId)) return;
          counts[institutionId] = (counts[institutionId] ?? 0) + 1;
        });
        setMediaCountByInstitutionId(counts);
      }

      setInstitutionsListLoading(false);
    };

    void loadInstitutionsPage();

    return () => {
      cancelled = true;
    };
  }, [activeTab, institutionsPage, institutionsReloadKey, institutionsSearchQuery]);

  useEffect(() => {
    if (activeTab !== "users") return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const loadIndividualUsersPage = async () => {
      setIndividualUsersListLoading(true);
      setIndividualUsersListError(null);

      const identifiers = await fetchAdminRoleIdentifiers(supabase);
      if (cancelled) return;

      const from = (individualUsersPage - 1) * INDIVIDUAL_USERS_PAGE_SIZE;
      const to = from + INDIVIDUAL_USERS_PAGE_SIZE - 1;

      let usersQuery = supabase
        .from("users")
        .select("id, first_name, last_name, email, auth_user_id, is_email_verified", {
          count: "exact",
        })
        .eq("user_type", "individual")
        .order("id", { ascending: false });

      if (identifiers.authUserIds.length > 0) {
        const quotedIds = identifiers.authUserIds.map((id) => `"${id}"`).join(",");
        usersQuery = usersQuery.not("auth_user_id", "in", `(${quotedIds})`);
      }
      if (identifiers.userIds.length > 0) {
        usersQuery = usersQuery.not("id", "in", `(${identifiers.userIds.join(",")})`);
      }

      const normalizedSearch = individualUsersSearchQuery.trim();
      if (normalizedSearch.length > 0) {
        usersQuery = usersQuery.or(
          `first_name.ilike.%${normalizedSearch}%,last_name.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%`
        );
      }

      const { data, count, error } = await usersQuery.range(from, to);

      if (cancelled) return;

      if (error) {
        setIndividualUsersList([]);
        setIndividualUsersTotalCount(0);
        setIndividualUsersListError("Bireysel kullanıcı listesi alınamadı.");
        setIndividualUsersListLoading(false);
        return;
      }

      const baseRows = (data ?? []) as Omit<
        IndividualUserListRow,
        "phone" | "profile_name" | "profile_surname"
      >[];
      const userIds = baseRows.map((row) => row.id).filter((id) => Number.isFinite(id));

      const profileByUserId = new Map<
        number,
        { phone: string | null; name: string | null; surname: string | null }
      >();

      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("individual_profiles")
          .select("user_id, phone, name, surname")
          .in("user_id", userIds);

        if (cancelled) return;

        if (!profileError) {
          (profileRows ?? []).forEach(
            (profile: {
              user_id: number | null;
              phone: string | null;
              name: string | null;
              surname: string | null;
            }) => {
              const userId = Number(profile.user_id);
              if (!Number.isFinite(userId)) return;
              profileByUserId.set(userId, {
                phone: profile.phone,
                name: profile.name,
                surname: profile.surname,
              });
            }
          );
        }
      }

      const mergedRows: IndividualUserListRow[] = baseRows.map((row) => {
        const profile = profileByUserId.get(row.id);
        return {
          ...row,
          phone: profile?.phone ?? null,
          profile_name: profile?.name ?? null,
          profile_surname: profile?.surname ?? null,
        };
      });

      setIndividualUsersList(mergedRows);
      setIndividualUsersTotalCount(count ?? 0);
      setIndividualUsersListLoading(false);
    };

    void loadIndividualUsersPage();

    return () => {
      cancelled = true;
    };
  }, [activeTab, individualUsersPage, individualUsersReloadKey, individualUsersSearchQuery]);

  useEffect(() => {
    if (activeTab !== "instructors") return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const loadInstructorsPage = async () => {
      setInstructorsListLoading(true);
      setInstructorsListError(null);

      const from = (instructorsPage - 1) * INSTRUCTORS_PAGE_SIZE;
      const to = from + INSTRUCTORS_PAGE_SIZE - 1;

      let instructorsQuery = supabase
        .from("instructors")
        .select("id, name, surname, email, phone, branch, district", { count: "exact" })
        .order("id", { ascending: false });

      const normalizedSearch = instructorsSearchQuery.trim();
      if (normalizedSearch.length > 0) {
        const relatedInstructorIds = await resolveInstructorIdsByProfileSearch(supabase, normalizedSearch);
        const variants = buildProfileSearchVariants(normalizedSearch).map(escapeProfileLikeValue).filter(Boolean);
        const searchColumns = [
          "name",
          "surname",
          "email",
          "phone",
          "title",
          "branch",
          "bio",
          "about",
          "school",
          "city",
          "district",
          "address",
          "education_level",
          "price_range",
          "website",
        ] as const;
        const orParts = variants.flatMap((term) => {
          const q = `%${term}%`;
          return searchColumns.map((col) => `${col}.ilike.${q}`);
        });
        const numericSearch = Number(normalizedSearch.replace(",", "."));
        if (Number.isFinite(numericSearch)) {
          orParts.push(`experience_years.eq.${numericSearch}`);
        }
        if (relatedInstructorIds.length > 0) {
          orParts.push(`id.in.(${relatedInstructorIds.join(",")})`);
        }
        if (orParts.length > 0) {
          instructorsQuery = instructorsQuery.or(orParts.join(","));
        }
      }

      const { data, count, error } = await instructorsQuery.range(from, to);

      if (cancelled) return;

      if (error) {
        setInstructorsList([]);
        setInstructorsTotalCount(0);
        setInstructorsListError("Bireysel eğitmen listesi alınamadı.");
        setInstructorsListLoading(false);
        return;
      }

      setInstructorsList((data ?? []) as InstructorListRow[]);
      setInstructorsTotalCount(count ?? 0);
      setInstructorsListLoading(false);
    };

    void loadInstructorsPage();

    return () => {
      cancelled = true;
    };
  }, [activeTab, instructorsPage, instructorsReloadKey, instructorsSearchQuery]);

  useEffect(() => {
    if (activeTab !== "announcements") return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const loadAnnouncementsPage = async () => {
      setAnnouncementsListLoading(true);
      setAnnouncementsListError(null);

      const from = (announcementsPage - 1) * ANNOUNCEMENTS_PAGE_SIZE;
      const to = from + ANNOUNCEMENTS_PAGE_SIZE - 1;

      let announcementsQuery = supabase
        .from("announcements")
        .select(
          "id, title, content, announcement_image_url, link_url, created_at, is_active",
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      const normalizedSearch = announcementsSearchQuery.trim();
      if (normalizedSearch.length > 0) {
        announcementsQuery = announcementsQuery.or(
          `title.ilike.%${normalizedSearch}%,content.ilike.%${normalizedSearch}%,link_url.ilike.%${normalizedSearch}%`
        );
      }

      const { data, count, error } = await announcementsQuery.range(from, to);

      if (cancelled) return;

      if (error) {
        setAnnouncementsList([]);
        setAnnouncementsTotalCount(0);
        setAnnouncementsListError("Duyuru listesi alınamadı.");
        setAnnouncementsListLoading(false);
        return;
      }

      setAnnouncementsList((data ?? []) as AnnouncementListRow[]);
      setAnnouncementsTotalCount(count ?? 0);
      setAnnouncementsListLoading(false);
    };

    void loadAnnouncementsPage();

    return () => {
      cancelled = true;
    };
  }, [activeTab, announcementsPage, announcementsReloadKey, announcementsSearchQuery]);

  useEffect(() => {
    if (activeTab !== "blog-posts") return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const loadBlogPostsPage = async () => {
      setBlogPostsListLoading(true);
      setBlogPostsListError(null);

      const from = (blogPostsPage - 1) * BLOG_POSTS_PAGE_SIZE;
      const to = from + BLOG_POSTS_PAGE_SIZE - 1;

      let blogQuery = supabase
        .from("blog_posts")
        .select(
          "id, title, content, author_full_name, author_type, category_id, cover_image_url, cover_image_path, is_published, published_at, created_at, category:institution_categories(name)",
          { count: "exact" }
        )
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      const normalizedSearch = blogPostsSearchQuery.trim();
      if (normalizedSearch.length > 0) {
        blogQuery = blogQuery.or(
          `title.ilike.%${normalizedSearch}%,author_full_name.ilike.%${normalizedSearch}%,content.ilike.%${normalizedSearch}%`
        );
      }

      const { data, count, error } = await blogQuery.range(from, to);

      if (cancelled) return;

      if (error) {
        setBlogPostsList([]);
        setBlogPostsTotalCount(0);
        setBlogPostsListError("Blog yazıları listesi alınamadı.");
        setBlogPostsListLoading(false);
        return;
      }

      setBlogPostsList((data ?? []) as BlogPostListRow[]);
      setBlogPostsTotalCount(count ?? 0);
      setBlogPostsListLoading(false);
    };

    void loadBlogPostsPage();

    return () => {
      cancelled = true;
    };
  }, [activeTab, blogPostsPage, blogPostsReloadKey, blogPostsSearchQuery]);

  useEffect(() => {
    if (activeTab !== "blog-posts") return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      const { data, error } = await supabase
        .from("institution_categories")
        .select("id, name, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (cancelled) return;

      if (error) {
        const fallback = await supabase
          .from("institution_categories")
          .select("id, name")
          .eq("is_active", true)
          .order("id", { ascending: true });

        if (cancelled) return;

        setBlogCategoryOptions(
          ((fallback.data ?? []) as Array<{ id: number; name: string | null }>)
            .map((row) => ({
              id: row.id,
              name: String(row.name ?? "").trim(),
            }))
            .filter((row) => row.name.length > 0)
        );
        return;
      }

      setBlogCategoryOptions(
        ((data ?? []) as Array<{ id: number; name: string | null }>)
          .map((row) => ({
            id: row.id,
            name: String(row.name ?? "").trim(),
          }))
          .filter((row) => row.name.length > 0)
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, blogPostsReloadKey]);

  const institutionsPageCount = Math.max(1, Math.ceil(institutionsTotalCount / INSTITUTIONS_PAGE_SIZE));
  const institutionsVisibleRangeStart = institutionsTotalCount === 0 ? 0 : (institutionsPage - 1) * INSTITUTIONS_PAGE_SIZE + 1;
  const institutionsVisibleRangeEnd = Math.min(
    institutionsPage * INSTITUTIONS_PAGE_SIZE,
    institutionsTotalCount
  );

  const individualUsersPageCount = Math.max(
    1,
    Math.ceil(individualUsersTotalCount / INDIVIDUAL_USERS_PAGE_SIZE)
  );
  const individualUsersVisibleRangeStart =
    individualUsersTotalCount === 0
      ? 0
      : (individualUsersPage - 1) * INDIVIDUAL_USERS_PAGE_SIZE + 1;
  const individualUsersVisibleRangeEnd = Math.min(
    individualUsersPage * INDIVIDUAL_USERS_PAGE_SIZE,
    individualUsersTotalCount
  );

  const instructorsPageCount = Math.max(1, Math.ceil(instructorsTotalCount / INSTRUCTORS_PAGE_SIZE));
  const instructorsVisibleRangeStart =
    instructorsTotalCount === 0 ? 0 : (instructorsPage - 1) * INSTRUCTORS_PAGE_SIZE + 1;
  const instructorsVisibleRangeEnd = Math.min(
    instructorsPage * INSTRUCTORS_PAGE_SIZE,
    instructorsTotalCount
  );

  const announcementsPageCount = Math.max(
    1,
    Math.ceil(announcementsTotalCount / ANNOUNCEMENTS_PAGE_SIZE)
  );
  const announcementsVisibleRangeStart =
    announcementsTotalCount === 0
      ? 0
      : (announcementsPage - 1) * ANNOUNCEMENTS_PAGE_SIZE + 1;
  const announcementsVisibleRangeEnd = Math.min(
    announcementsPage * ANNOUNCEMENTS_PAGE_SIZE,
    announcementsTotalCount
  );

  const blogPostsPageCount = Math.max(1, Math.ceil(blogPostsTotalCount / BLOG_POSTS_PAGE_SIZE));
  const blogPostsVisibleRangeStart =
    blogPostsTotalCount === 0 ? 0 : (blogPostsPage - 1) * BLOG_POSTS_PAGE_SIZE + 1;
  const blogPostsVisibleRangeEnd = Math.min(
    blogPostsPage * BLOG_POSTS_PAGE_SIZE,
    blogPostsTotalCount
  );

  useEffect(() => {
    setInstitutionsPageInput(String(institutionsPage));
  }, [institutionsPage]);

  useEffect(() => {
    setIndividualUsersPageInput(String(individualUsersPage));
  }, [individualUsersPage]);

  useEffect(() => {
    setInstructorsPageInput(String(instructorsPage));
  }, [instructorsPage]);

  useEffect(() => {
    setAnnouncementsPageInput(String(announcementsPage));
  }, [announcementsPage]);

  useEffect(() => {
    setBlogPostsPageInput(String(blogPostsPage));
  }, [blogPostsPage]);

  const handleGoToInstitutionsPage = () => {
    const parsed = Number.parseInt(institutionsPageInput, 10);
    if (!Number.isFinite(parsed)) {
      setInstitutionsPageInput(String(institutionsPage));
      return;
    }
    const targetPage = Math.min(Math.max(parsed, 1), institutionsPageCount);
    setInstitutionsPage(targetPage);
  };

  const handleInstitutionSearch = () => {
    setInstitutionsPage(1);
    setInstitutionsSearchQuery(institutionsSearchInput.trim());
  };

  const handleGoToIndividualUsersPage = () => {
    const parsed = Number.parseInt(individualUsersPageInput, 10);
    if (!Number.isFinite(parsed)) {
      setIndividualUsersPageInput(String(individualUsersPage));
      return;
    }
    const targetPage = Math.min(Math.max(parsed, 1), individualUsersPageCount);
    setIndividualUsersPage(targetPage);
  };

  const handleIndividualUserSearch = () => {
    setIndividualUsersPage(1);
    setIndividualUsersSearchQuery(individualUsersSearchInput.trim());
  };

  const handleGoToInstructorsPage = () => {
    const parsed = Number.parseInt(instructorsPageInput, 10);
    if (!Number.isFinite(parsed)) {
      setInstructorsPageInput(String(instructorsPage));
      return;
    }
    const targetPage = Math.min(Math.max(parsed, 1), instructorsPageCount);
    setInstructorsPage(targetPage);
  };

  const handleInstructorSearch = () => {
    setInstructorsPage(1);
    setInstructorsSearchQuery(instructorsSearchInput.trim());
  };

  const handleOpenInstructorEdit = (row: InstructorListRow) => {
    setEditingInstructor(row);
    setInstructorEditForm({
      name: String(row.name ?? "").trim(),
      surname: String(row.surname ?? "").trim(),
      email: String(row.email ?? "").trim(),
      phone: String(row.phone ?? "").trim(),
      branch: String(row.branch ?? "").trim(),
      district: String(row.district ?? "").trim(),
    });
    setInstructorEditError(null);
    setInstructorEditPhoneError(null);
  };

  const handleCloseInstructorEdit = () => {
    if (instructorEditSaving) return;
    setEditingInstructor(null);
    setInstructorEditError(null);
    setInstructorEditPhoneError(null);
  };

  const handleInstructorPhoneChange = (value: string) => {
    setInstructorEditPhoneError(null);
    setInstructorEditForm((prev) => ({
      ...prev,
      phone: cleanIndividualUserPhoneInput(value),
    }));
  };

  const handleSaveInstructorEdit = async () => {
    if (!editingInstructor) return;

    if (!isValidIndividualUserPhone(instructorEditForm.phone)) {
      setInstructorEditPhoneError("Geçerli bir telefon numarası girin.");
      return;
    }

    setInstructorEditSaving(true);
    setInstructorEditError(null);
    setInstructorEditPhoneError(null);

    try {
      const response = await fetch(`/api/admin/instructors/${editingInstructor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: instructorEditForm.name,
          surname: instructorEditForm.surname,
          email: instructorEditForm.email,
          phone: instructorEditForm.phone,
          branch: instructorEditForm.branch,
          district: instructorEditForm.district,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        const message = payload?.error ?? "Eğitmen bilgileri güncellenemedi.";
        if (message.toLowerCase().includes("telefon")) {
          setInstructorEditPhoneError(message);
        } else {
          setInstructorEditError(message);
        }
        return;
      }

      setEditingInstructor(null);
      setInstructorsReloadKey((prev) => prev + 1);
    } catch {
      setInstructorEditError("Eğitmen bilgileri güncellenemedi.");
    } finally {
      setInstructorEditSaving(false);
    }
  };

  const handleRequestDeleteInstructor = (instructorId: number) => {
    setDeleteConfirmError(null);
    setDeleteConfirmTarget({ type: "instructor", id: instructorId });
  };

  const handleGoToAnnouncementsPage = () => {
    const parsed = Number.parseInt(announcementsPageInput, 10);
    if (!Number.isFinite(parsed)) {
      setAnnouncementsPageInput(String(announcementsPage));
      return;
    }
    const targetPage = Math.min(Math.max(parsed, 1), announcementsPageCount);
    setAnnouncementsPage(targetPage);
  };

  const handleAnnouncementSearch = () => {
    setAnnouncementsPage(1);
    setAnnouncementsSearchQuery(announcementsSearchInput.trim());
  };

  const handleGoToBlogPostsPage = () => {
    const parsed = Number.parseInt(blogPostsPageInput, 10);
    if (!Number.isFinite(parsed)) {
      setBlogPostsPageInput(String(blogPostsPage));
      return;
    }
    const targetPage = Math.min(Math.max(parsed, 1), blogPostsPageCount);
    setBlogPostsPage(targetPage);
  };

  const handleBlogPostsSearch = () => {
    setBlogPostsPage(1);
    setBlogPostsSearchQuery(blogPostsSearchInput.trim());
  };

  const handleOpenBlogPostEdit = (row: BlogPostListRow) => {
    setEditingBlogPost(row);
    setBlogPostEditForm({
      title: String(row.title ?? "").trim(),
      content: String(row.content ?? "").trim(),
      categoryId: row.category_id != null ? String(row.category_id) : "",
      coverImageUrl: String(row.cover_image_url ?? "").trim(),
      isPublished: row.is_published !== false,
    });
    setBlogPostEditError(null);
  };

  const handleCloseBlogPostEdit = () => {
    if (blogPostEditSaving) return;
    setEditingBlogPost(null);
    setBlogPostEditError(null);
  };

  const handleSaveBlogPostEdit = async () => {
    if (!editingBlogPost) return;

    const title = blogPostEditForm.title.trim();
    const content = blogPostEditForm.content.trim();
    const categoryId = blogPostEditForm.categoryId.trim();

    if (!title) {
      setBlogPostEditError("Başlık zorunludur.");
      return;
    }
    if (!content) {
      setBlogPostEditError("İçerik zorunludur.");
      return;
    }
    if (!categoryId) {
      setBlogPostEditError("Kategori seçimi zorunludur.");
      return;
    }

    setBlogPostEditSaving(true);
    setBlogPostEditError(null);
    const supabase = createSupabaseBrowserClient();

    try {
      const { error } = await supabase
        .from("blog_posts")
        .update({
          title,
          content,
          category_id: Number.parseInt(categoryId, 10),
          cover_image_url: blogPostEditForm.coverImageUrl.trim() || null,
          is_published: blogPostEditForm.isPublished,
        })
        .eq("id", editingBlogPost.id);

      if (error) {
        setBlogPostEditError("Blog yazısı güncellenemedi.");
        return;
      }

      setEditingBlogPost(null);
      setBlogPostsReloadKey((prev) => prev + 1);
    } finally {
      setBlogPostEditSaving(false);
    }
  };

  const handleRequestDeleteBlogPost = (blogPostId: string) => {
    setDeleteConfirmError(null);
    setDeleteConfirmTarget({ type: "blog-post", id: blogPostId });
  };

  const handleOpenAnnouncementEdit = (row: AnnouncementListRow) => {
    setEditingAnnouncement(row);
    setAnnouncementEditForm({
      title: String(row.title ?? "").trim(),
      content: String(row.content ?? "").trim(),
      announcementImageUrl: String(row.announcement_image_url ?? "").trim(),
      linkUrl: String(row.link_url ?? "").trim(),
      isActive: row.is_active === true,
    });
    setAnnouncementEditError(null);
  };

  const handleCloseAnnouncementEdit = () => {
    if (announcementEditSaving) return;
    setEditingAnnouncement(null);
    setAnnouncementEditError(null);
  };

  const handleSaveAnnouncementEdit = async () => {
    if (!editingAnnouncement) return;

    const title = announcementEditForm.title.trim();
    const content = announcementEditForm.content.trim();
    if (!title) {
      setAnnouncementEditError("Başlık zorunludur.");
      return;
    }
    if (!content) {
      setAnnouncementEditError("İçerik zorunludur.");
      return;
    }

    setAnnouncementEditSaving(true);
    setAnnouncementEditError(null);
    const supabase = createSupabaseBrowserClient();

    try {
      const { error } = await supabase
        .from("announcements")
        .update({
          title,
          content,
          announcement_image_url: announcementEditForm.announcementImageUrl.trim() || null,
          link_url: announcementEditForm.linkUrl.trim() || null,
          is_active: announcementEditForm.isActive,
        })
        .eq("id", editingAnnouncement.id);

      if (error) {
        setAnnouncementEditError("Duyuru güncellenemedi.");
        return;
      }

      setEditingAnnouncement(null);
      setAnnouncementsReloadKey((prev) => prev + 1);
    } finally {
      setAnnouncementEditSaving(false);
    }
  };

  const handleRequestDeleteAnnouncement = (announcementId: string) => {
    setDeleteConfirmError(null);
    setDeleteConfirmTarget({ type: "announcement", id: announcementId });
  };

  const handleOpenIndividualUserEdit = (row: IndividualUserListRow) => {
    setEditingIndividualUser(row);
    setIndividualUserEditForm({
      firstName: String(row.profile_name ?? row.first_name ?? "").trim(),
      lastName: String(row.profile_surname ?? row.last_name ?? "").trim(),
      email: String(row.email ?? "").trim(),
      phone: String(row.phone ?? "").trim(),
    });
    setIndividualUserEditError(null);
    setIndividualUserEditPhoneError(null);
  };

  const handleCloseIndividualUserEdit = () => {
    if (individualUserEditSaving) return;
    setEditingIndividualUser(null);
    setIndividualUserEditError(null);
    setIndividualUserEditPhoneError(null);
  };

  const handleIndividualUserPhoneChange = (value: string) => {
    setIndividualUserEditPhoneError(null);
    setIndividualUserEditForm((prev) => ({
      ...prev,
      phone: cleanIndividualUserPhoneInput(value),
    }));
  };

  const handleSaveIndividualUserEdit = async () => {
    if (!editingIndividualUser) return;

    if (!isValidIndividualUserPhone(individualUserEditForm.phone)) {
      setIndividualUserEditPhoneError("Geçerli bir telefon numarası girin.");
      return;
    }

    setIndividualUserEditSaving(true);
    setIndividualUserEditError(null);
    setIndividualUserEditPhoneError(null);
    const supabase = createSupabaseBrowserClient();

    try {
      const { error: usersError } = await supabase
        .from("users")
        .update({
          first_name: individualUserEditForm.firstName.trim() || null,
          last_name: individualUserEditForm.lastName.trim() || null,
          email: individualUserEditForm.email.trim() || null,
        })
        .eq("id", editingIndividualUser.id);

      if (usersError) {
        setIndividualUserEditError("Kullanıcı bilgileri güncellenemedi.");
        return;
      }

      const { error: profileError } = await supabase
        .from("individual_profiles")
        .update({
          name: individualUserEditForm.firstName.trim() || null,
          surname: individualUserEditForm.lastName.trim() || null,
          phone: individualUserEditForm.phone.trim() || null,
        })
        .eq("user_id", editingIndividualUser.id);

      if (profileError) {
        console.warn("[AdminPageClient] individual_profiles update", profileError);
      }

      setEditingIndividualUser(null);
      setIndividualUsersReloadKey((prev) => prev + 1);
    } finally {
      setIndividualUserEditSaving(false);
    }
  };

  const handleRequestDeleteIndividualUser = (userId: number) => {
    setDeleteConfirmError(null);
    setDeleteConfirmTarget({ type: "individual-user", id: userId });
  };

  const handleRequestDeleteInstitution = (institutionId: number) => {
    setDeleteConfirmError(null);
    setDeleteConfirmTarget({ type: "institution", id: institutionId });
  };

  const handleCancelDeleteConfirm = () => {
    if (
      deletingIndividualUserId !== null ||
      deletingInstitutionId !== null ||
      deletingInstructorId !== null ||
      deletingAnnouncementId !== null ||
      deletingBlogPostId !== null
    ) {
      return;
    }
    setDeleteConfirmTarget(null);
    setDeleteConfirmError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;

    if (deleteConfirmTarget.type === "individual-user") {
      const userId = deleteConfirmTarget.id;
      setDeletingIndividualUserId(userId);
      setDeleteConfirmError(null);
      try {
        const response = await fetch(`/api/admin/individual-users/${userId}`, {
          method: "DELETE",
        });
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          setDeleteConfirmError(payload?.error ?? "Kullanıcı silinirken bir hata oluştu.");
          return;
        }

        const nextTotal = Math.max(0, individualUsersTotalCount - 1);
        setIndividualUsersTotalCount(nextTotal);
        setUsersCount((prev) => (typeof prev === "number" ? Math.max(0, prev - 1) : prev));
        if (
          individualUsersPage > 1 &&
          (individualUsersPage - 1) * INDIVIDUAL_USERS_PAGE_SIZE >= nextTotal
        ) {
          setIndividualUsersPage((prev) => Math.max(1, prev - 1));
        } else {
          setIndividualUsersReloadKey((prev) => prev + 1);
        }
        setDeleteConfirmTarget(null);
        setDeleteConfirmError(null);
      } catch {
        setDeleteConfirmError("Kullanıcı silinirken bir hata oluştu.");
      } finally {
        setDeletingIndividualUserId(null);
      }
      return;
    }

    if (deleteConfirmTarget.type === "instructor") {
      const instructorId = deleteConfirmTarget.id;
      setDeletingInstructorId(instructorId);
      setDeleteConfirmError(null);
      try {
        const response = await fetch(`/api/admin/instructors/${instructorId}`, {
          method: "DELETE",
        });
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          setDeleteConfirmError(payload?.error ?? "Eğitmen silinirken bir hata oluştu.");
          return;
        }

        const nextTotal = Math.max(0, instructorsTotalCount - 1);
        setInstructorsTotalCount(nextTotal);
        setInstructorsCount((prev) => (typeof prev === "number" ? Math.max(0, prev - 1) : prev));
        if (instructorsPage > 1 && (instructorsPage - 1) * INSTRUCTORS_PAGE_SIZE >= nextTotal) {
          setInstructorsPage((prev) => Math.max(1, prev - 1));
        } else {
          setInstructorsReloadKey((prev) => prev + 1);
        }
        setDeleteConfirmTarget(null);
        setDeleteConfirmError(null);
      } catch {
        setDeleteConfirmError("Eğitmen silinirken bir hata oluştu.");
      } finally {
        setDeletingInstructorId(null);
      }
      return;
    }

    if (deleteConfirmTarget.type === "announcement") {
      const announcementId = deleteConfirmTarget.id;
      const supabase = createSupabaseBrowserClient();
      setDeletingAnnouncementId(announcementId);
      setDeleteConfirmError(null);
      try {
        const { error } = await supabase.from("announcements").delete().eq("id", announcementId);
        if (error) {
          setDeleteConfirmError("Duyuru silinirken bir hata oluştu.");
          return;
        }

        const nextTotal = Math.max(0, announcementsTotalCount - 1);
        setAnnouncementsTotalCount(nextTotal);
        setAnnouncementsCount((prev) => (typeof prev === "number" ? Math.max(0, prev - 1) : prev));
        if (
          announcementsPage > 1 &&
          (announcementsPage - 1) * ANNOUNCEMENTS_PAGE_SIZE >= nextTotal
        ) {
          setAnnouncementsPage((prev) => Math.max(1, prev - 1));
        } else {
          setAnnouncementsReloadKey((prev) => prev + 1);
        }
        setDeleteConfirmTarget(null);
        setDeleteConfirmError(null);
      } finally {
        setDeletingAnnouncementId(null);
      }
      return;
    }

    if (deleteConfirmTarget.type === "blog-post") {
      const blogPostId = deleteConfirmTarget.id;
      const supabase = createSupabaseBrowserClient();
      setDeletingBlogPostId(blogPostId);
      setDeleteConfirmError(null);
      try {
        const { error } = await supabase.from("blog_posts").delete().eq("id", blogPostId);
        if (error) {
          setDeleteConfirmError("Blog yazısı silinirken bir hata oluştu.");
          return;
        }

        const nextTotal = Math.max(0, blogPostsTotalCount - 1);
        setBlogPostsTotalCount(nextTotal);
        if (blogPostsPage > 1 && (blogPostsPage - 1) * BLOG_POSTS_PAGE_SIZE >= nextTotal) {
          setBlogPostsPage((prev) => Math.max(1, prev - 1));
        } else {
          setBlogPostsReloadKey((prev) => prev + 1);
        }
        setDeleteConfirmTarget(null);
        setDeleteConfirmError(null);
      } finally {
        setDeletingBlogPostId(null);
      }
      return;
    }

    const institutionId = deleteConfirmTarget.id;
    const supabase = createSupabaseBrowserClient();
    setDeletingInstitutionId(institutionId);
    try {
      const { error } = await supabase.from("institutions").delete().eq("id", institutionId);
      if (error) {
        setInstitutionsListError("Kurum silinirken bir hata oluştu.");
        return;
      }

      const nextTotal = Math.max(0, institutionsTotalCount - 1);
      setInstitutionsTotalCount(nextTotal);
      setInstitutionsCount((prev) => (typeof prev === "number" ? Math.max(0, prev - 1) : prev));
      if (institutionsPage > 1 && (institutionsPage - 1) * INSTITUTIONS_PAGE_SIZE >= nextTotal) {
        setInstitutionsPage((prev) => Math.max(1, prev - 1));
      } else {
        setInstitutionsReloadKey((prev) => prev + 1);
      }
      setDeleteConfirmTarget(null);
    } finally {
      setDeletingInstitutionId(null);
    }
  };

  const institutionsRows = useMemo(() => {
    return institutionsList.map((row) => {
      const category =
        String(row.institution_type?.category?.name ?? "").trim() ||
        String(row.institution_type?.name ?? "").trim() ||
        String(row.type ?? "").trim() ||
        "-";
      return {
        id: row.id,
        name: String(row.institution_name ?? "").trim() || "-",
        category,
        district: String(row.district ?? "").trim() || "-",
        mediaCount: mediaCountByInstitutionId[row.id] ?? 0,
      };
    });
  }, [institutionsList, mediaCountByInstitutionId]);

  const individualUsersRows = useMemo(() => {
    return individualUsersList.map((row) => ({
      id: row.id,
      fullName: resolveIndividualUserFullName(row),
      email: String(row.email ?? "").trim() || "-",
      phone: String(row.phone ?? "").trim() || "-",
      isEmailVerified: row.is_email_verified === true,
      sourceRow: row,
    }));
  }, [individualUsersList]);

  const instructorsRows = useMemo(() => {
    return instructorsList.map((row) => ({
      id: row.id,
      fullName: resolveInstructorFullName(row),
      email: String(row.email ?? "").trim() || "-",
      phone: String(row.phone ?? "").trim() || "-",
      branch: String(row.branch ?? "").trim() || "-",
      district: String(row.district ?? "").trim() || "-",
      sourceRow: row,
    }));
  }, [instructorsList]);

  const announcementsRows = useMemo(() => {
    return announcementsList.map((row) => ({
      id: row.id,
      title: String(row.title ?? "").trim() || "-",
      contentPreview: buildAnnouncementContentPreview(row.content),
      linkUrl: String(row.link_url ?? "").trim() || "-",
      isActive: row.is_active === true,
      createdAt: formatAnnouncementDate(row.created_at),
      sourceRow: row,
    }));
  }, [announcementsList]);

  const blogPostsRows = useMemo(() => {
    return blogPostsList.map((row) => ({
      id: row.id,
      
      title: String(row.title ?? "").trim() || "-",
      authorName: String(row.author_full_name ?? "").trim() || "-",
      authorType: row.author_type,
      authorTypeLabel: resolveBlogAuthorTypeLabel(row.author_type),
      publishedDate: formatBlogPostAdminDate(row.published_at, row.created_at),
      categoryName: resolveBlogCategoryName(row.category),
    }));
  }, [blogPostsList]);

  const deleteConfirmModal = useMemo(() => {
    if (!deleteConfirmTarget) return null;

    if (deleteConfirmTarget.type === "individual-user") {
      return {
        title: "Bireysel Kullanıcıyı Sil",
        message: "Bu bireysel kullanıcıyı silmek istediğinize emin misiniz?",
        confirmLabel: "Sil",
        loading: deletingIndividualUserId === deleteConfirmTarget.id,
      };
    }

    if (deleteConfirmTarget.type === "instructor") {
      return {
        title: "Bireysel Eğitmeni Sil",
        message: "Bu bireysel eğitmeni silmek istediğinize emin misiniz?",
        confirmLabel: "Sil",
        loading: deletingInstructorId === deleteConfirmTarget.id,
      };
    }

    if (deleteConfirmTarget.type === "announcement") {
      return {
        title: "Duyuruyu Sil",
        message: "Bu duyuruyu silmek istediğinize emin misiniz?",
        confirmLabel: "Sil",
        loading: deletingAnnouncementId === deleteConfirmTarget.id,
      };
    }

    if (deleteConfirmTarget.type === "blog-post") {
      return {
        title: "Blog Yazısını Sil",
        message: "Bu blog yazısını silmek istediğinize emin misiniz?",
        confirmLabel: "Sil",
        loading: deletingBlogPostId === deleteConfirmTarget.id,
      };
    }

    return {
      title: "Kurumu Sil",
      message: "Bu kurumu silmek istediğinize emin misiniz?",
      confirmLabel: "Sil",
      loading: deletingInstitutionId === deleteConfirmTarget.id,
    };
  }, [
    deleteConfirmTarget,
    deletingIndividualUserId,
    deletingInstitutionId,
    deletingInstructorId,
    deletingAnnouncementId,
    deletingBlogPostId,
  ]);

  const activeTabTitle =
    activeTab === "users"
      ? "Bireysel Kullanıcılar"
      : activeTab === "instructors"
        ? "Eğitmenler"
      : activeTab === "announcements"
        ? "Duyurular"
        : activeTab === "blog-posts"
          ? "Blog Yazıları"
          : activeTab === "settings"
            ? "Ayarlar"
            : "";

  return (
    <div className="admin-page">
      <HeaderClientWrapper />
      <div className="admin-page-container">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-content">
            <div className="admin-sidebar-avatar">
              <div className="admin-sidebar-avatar-placeholder">
                <Shield className="admin-sidebar-avatar-icon" />
              </div>
            </div>
            <h2 className="admin-sidebar-name">Admin Panel</h2>

            <nav className="admin-sidebar-nav">
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "overview" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("overview")}
              >
                <BarChart3 className="admin-sidebar-nav-icon" />
                <span>Genel Bakış</span>
              </button>
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "institutions" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("institutions")}
              >
                <Building2 className="admin-sidebar-nav-icon" />
                <span>Kurumlar</span>
              </button>
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "users" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("users")}
              >
                <Users className="admin-sidebar-nav-icon" />
                <span>Bireysel Kullanıcılar</span>
              </button>
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "instructors" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("instructors")}
              >
                <User className="admin-sidebar-nav-icon" />
                <span>Eğitmenler</span>
              </button>
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "announcements" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("announcements")}
              >
                <Megaphone className="admin-sidebar-nav-icon" />
                <span>Duyurular</span>
              </button>
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "blog-posts" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("blog-posts")}
              >
                <BookOpenText className="admin-sidebar-nav-icon" />
                <span>Blog Yazıları</span>
              </button>
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "settings" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("settings")}
              >
                <Settings className="admin-sidebar-nav-icon" />
                <span>Ayarlar</span>
              </button>
              <button
                type="button"
                className="admin-sidebar-nav-item admin-sidebar-nav-item--logout"
                onClick={handleLogout}
              >
                <LogOut className="admin-sidebar-nav-icon" />
                <span>Çıkış Yap</span>
              </button>
            </nav>
          </div>
        </aside>

        <div className="admin-page-main">
          <div className="admin-overview-metrics-grid">
            {metrics.map((metric) => (
              <Card key={metric.id} className="admin-overview-metric-card">
                <CardContent className="admin-overview-metric-card-content">
                  <div className="admin-overview-metric-top">
                    {metric.icon}
                    <span className="admin-overview-metric-title">{metric.title}</span>
                  </div>
                  <div className="admin-overview-metric-value-wrap">
                    {metric.loading ? (
                      <span className="admin-overview-metric-value">Yükleniyor...</span>
                    ) : metric.error ? (
                      <span className="admin-overview-metric-error">{metric.error}</span>
                    ) : (
                      <span className="admin-overview-metric-value">
                        {metric.value ?? "-"}
                      </span>
                    )}
                  </div>
                  {metric.note ? (
                    <p className="admin-overview-metric-note">{metric.note}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          {activeTab === "overview" ? (
            <Card className="admin-main-card">
              <CardContent className="admin-main-card-content">
                <div className="admin-main-card-header">
                  <h1 className="admin-main-card-title">Genel Bakış</h1>
                  <p className="admin-main-card-subtitle">
                    Yönetim metrikleri bu alanda görüntülenir.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "institutions" ? (
            <Card className="admin-main-card">
              <CardContent className="admin-main-card-content admin-main-card-content--institutions">
                <div className="admin-main-card-header admin-main-card-header--institutions">
                  <div className="admin-institutions-header-left">
                    <h1 className="admin-main-card-title">Kayıtlı Kurumlar</h1>
                    <span className="admin-institutions-total-badge">
                      {`${institutionsTotalCount.toLocaleString("tr-TR")} TOPLAM`}
                    </span>
                  </div>
                  <div className="admin-institutions-header-actions">
                    <div className="admin-institutions-header-search">
                      <input
                        type="text"
                        className="admin-institutions-page-search-input"
                        value={institutionsSearchInput}
                        onChange={(event) => setInstitutionsSearchInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleInstitutionSearch();
                          }
                        }}
                        placeholder="Kurum ara"
                      />
                      <button
                        type="button"
                        className="admin-institutions-page-jump-btn"
                        onClick={handleInstitutionSearch}
                      >
                        Ara
                      </button>
                    </div>
                  </div>
                </div>

                {institutionsListLoading ? (
                  <div className="admin-institutions-empty">Yükleniyor...</div>
                ) : institutionsListError ? (
                  <div className="admin-institutions-empty">{institutionsListError}</div>
                ) : institutionsRows.length === 0 ? (
                  <div className="admin-institutions-empty">Kurum bulunamadı.</div>
                ) : (
                  <>
                    <table className="admin-institutions-table">
                      <thead>
                        <tr>
                          <th>Kurum Adı</th>
                          <th>Kategori</th>
                          <th>İlçe</th>
                          <th>Görsel Sayısı</th>
                          <th>Düzenle</th>
                          <th>Sil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {institutionsRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.name}</td>
                            <td className="admin-institutions-category-cell">
                              <span className="admin-institutions-category-badge">
                                {row.category}
                              </span>
                            </td>
                            <td>{row.district}</td>
                            <td>{row.mediaCount}</td>
                            <td>
                              <Link href={`/panel?institutionId=${row.id}`} className="admin-institutions-action-btn" aria-label="Kurum düzenle">
                                <PencilLine size={16} />
                              </Link>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="admin-institutions-action-btn admin-institutions-action-btn--danger"
                                onClick={() => handleRequestDeleteInstitution(row.id)}
                                disabled={deletingInstitutionId === row.id}
                                aria-label="Kurum sil"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="admin-institutions-pagination">
                      <p className="admin-institutions-pagination-info">
                        {`${institutionsVisibleRangeStart} - ${institutionsVisibleRangeEnd} / ${institutionsTotalCount} kurum gösteriliyor`}
                      </p>
                      <div className="admin-institutions-pagination-controls">
                        <button
                          type="button"
                          className="admin-institutions-page-btn"
                          disabled={institutionsPage <= 1}
                          onClick={() => setInstitutionsPage((prev) => Math.max(1, prev - 1))}
                        >
                          ‹
                        </button>
                        <span className="admin-institutions-page-indicator">
                          {institutionsPage} / {institutionsPageCount}
                        </span>
                        <button
                          type="button"
                          className="admin-institutions-page-btn"
                          disabled={institutionsPage >= institutionsPageCount}
                          onClick={() =>
                            setInstitutionsPage((prev) => Math.min(institutionsPageCount, prev + 1))
                          }
                        >
                          ›
                        </button>
                        <div className="admin-institutions-page-jump">
                          <span className="admin-institutions-page-jump-label">Sayfaya git</span>
                          <input
                            type="number"
                            min={1}
                            max={institutionsPageCount}
                            className="admin-institutions-page-jump-input"
                            value={institutionsPageInput}
                            onChange={(event) => setInstitutionsPageInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleGoToInstitutionsPage();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="admin-institutions-page-jump-btn"
                            onClick={handleGoToInstitutionsPage}
                          >
                            Git
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "users" ? (
            <Card className="admin-main-card">
              <CardContent className="admin-main-card-content admin-main-card-content--individual-users">
                <div className="admin-main-card-header admin-main-card-header--individual-users">
                  <div className="admin-individual-users-header-left">
                    <h1 className="admin-main-card-title">Bireysel Kullanıcılar</h1>
                    <span className="admin-individual-users-total-badge">
                      {`${individualUsersTotalCount.toLocaleString("tr-TR")} TOPLAM`}
                    </span>
                  </div>
                  <div className="admin-individual-users-header-actions">
                    <div className="admin-individual-users-header-search">
                      <input
                        type="text"
                        className="admin-individual-users-page-search-input"
                        value={individualUsersSearchInput}
                        onChange={(event) => setIndividualUsersSearchInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleIndividualUserSearch();
                          }
                        }}
                        placeholder="Kullanıcı ara"
                      />
                      <button
                        type="button"
                        className="admin-individual-users-page-jump-btn"
                        onClick={handleIndividualUserSearch}
                      >
                        Ara
                      </button>
                    </div>
                  </div>
                </div>

                {individualUsersListLoading ? (
                  <div className="admin-individual-users-empty">Yükleniyor...</div>
                ) : individualUsersListError ? (
                  <div className="admin-individual-users-empty">{individualUsersListError}</div>
                ) : individualUsersRows.length === 0 ? (
                  <div className="admin-individual-users-empty">Bireysel kullanıcı bulunamadı.</div>
                ) : (
                  <>
                    <table className="admin-individual-users-table">
                      <thead>
                        <tr>
                          <th>Ad Soyad</th>
                          <th>E-posta</th>
                          <th>Telefon</th>
                          <th>E-posta Onayı</th>
                          <th>Düzenle</th>
                          <th>Sil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {individualUsersRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.fullName}</td>
                            <td>{row.email}</td>
                            <td>{row.phone}</td>
                            <td className="admin-individual-users-email-verified-cell">
                              <span
                                className={
                                  row.isEmailVerified
                                    ? "admin-individual-users-email-verified-badge admin-individual-users-email-verified-badge--verified"
                                    : "admin-individual-users-email-verified-badge admin-individual-users-email-verified-badge--unverified"
                                }
                                aria-label={
                                  row.isEmailVerified ? "E-posta onaylı" : "E-posta onaylanmadı"
                                }
                                title={
                                  row.isEmailVerified ? "E-posta onaylı" : "E-posta onaylanmadı"
                                }
                              >
                                {row.isEmailVerified ? (
                                  <Check size={14} aria-hidden />
                                ) : (
                                  <X size={14} aria-hidden />
                                )}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="admin-individual-users-action-btn"
                                onClick={() => handleOpenIndividualUserEdit(row.sourceRow)}
                                aria-label="Kullanıcı düzenle"
                              >
                                <PencilLine size={16} />
                              </button>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="admin-individual-users-action-btn admin-individual-users-action-btn--danger"
                                onClick={() => handleRequestDeleteIndividualUser(row.id)}
                                disabled={deletingIndividualUserId === row.id}
                                aria-label="Kullanıcı sil"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="admin-individual-users-pagination">
                      <p className="admin-individual-users-pagination-info">
                        {`${individualUsersVisibleRangeStart} - ${individualUsersVisibleRangeEnd} / ${individualUsersTotalCount} kullanıcı gösteriliyor`}
                      </p>
                      <div className="admin-individual-users-pagination-controls">
                        <button
                          type="button"
                          className="admin-individual-users-page-btn"
                          disabled={individualUsersPage <= 1}
                          onClick={() => setIndividualUsersPage((prev) => Math.max(1, prev - 1))}
                        >
                          ‹
                        </button>
                        <span className="admin-individual-users-page-indicator">
                          {individualUsersPage} / {individualUsersPageCount}
                        </span>
                        <button
                          type="button"
                          className="admin-individual-users-page-btn"
                          disabled={individualUsersPage >= individualUsersPageCount}
                          onClick={() =>
                            setIndividualUsersPage((prev) =>
                              Math.min(individualUsersPageCount, prev + 1)
                            )
                          }
                        >
                          ›
                        </button>
                        <div className="admin-individual-users-page-jump">
                          <span className="admin-individual-users-page-jump-label">Sayfaya git</span>
                          <input
                            type="number"
                            min={1}
                            max={individualUsersPageCount}
                            className="admin-individual-users-page-jump-input"
                            value={individualUsersPageInput}
                            onChange={(event) => setIndividualUsersPageInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleGoToIndividualUsersPage();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="admin-individual-users-page-jump-btn"
                            onClick={handleGoToIndividualUsersPage}
                          >
                            Git
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "instructors" ? (
            <Card className="admin-main-card">
              <CardContent className="admin-main-card-content admin-main-card-content--instructors">
                <div className="admin-main-card-header admin-main-card-header--instructors">
                  <div className="admin-instructors-header-left">
                    <h1 className="admin-main-card-title">Eğitmenler</h1>
                    <span className="admin-instructors-total-badge">
                      {`${instructorsTotalCount.toLocaleString("tr-TR")} TOPLAM`}
                    </span>
                  </div>
                  <div className="admin-instructors-header-actions">
                    <div className="admin-instructors-header-search">
                      <input
                        type="text"
                        className="admin-instructors-page-search-input"
                        value={instructorsSearchInput}
                        onChange={(event) => setInstructorsSearchInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleInstructorSearch();
                          }
                        }}
                        placeholder="Eğitmen ara"
                      />
                      <button
                        type="button"
                        className="admin-instructors-page-jump-btn"
                        onClick={handleInstructorSearch}
                      >
                        Ara
                      </button>
                    </div>
                  </div>
                </div>

                {instructorsListLoading ? (
                  <div className="admin-instructors-empty">Yükleniyor...</div>
                ) : instructorsListError ? (
                  <div className="admin-instructors-empty">{instructorsListError}</div>
                ) : instructorsRows.length === 0 ? (
                  <div className="admin-instructors-empty">Bireysel eğitmen bulunamadı.</div>
                ) : (
                  <>
                    <table className="admin-instructors-table">
                      <thead>
                        <tr>
                          <th>Ad Soyad</th>
                          <th>E-posta</th>
                          <th>Telefon</th>
                          <th>Branş</th>
                          <th>İlçe</th>
                          <th>Düzenle</th>
                          <th>Sil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {instructorsRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.fullName}</td>
                            <td>{row.email}</td>
                            <td>{row.phone}</td>
                            <td>{row.branch}</td>
                            <td>{row.district}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-instructors-action-btn"
                                onClick={() => handleOpenInstructorEdit(row.sourceRow)}
                                aria-label="Eğitmen düzenle"
                              >
                                <PencilLine size={16} />
                              </button>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="admin-instructors-action-btn admin-instructors-action-btn--danger"
                                onClick={() => handleRequestDeleteInstructor(row.id)}
                                disabled={deletingInstructorId === row.id}
                                aria-label="Eğitmen sil"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="admin-instructors-pagination">
                      <p className="admin-instructors-pagination-info">
                        {`${instructorsVisibleRangeStart} - ${instructorsVisibleRangeEnd} / ${instructorsTotalCount} eğitmen gösteriliyor`}
                      </p>
                      <div className="admin-instructors-pagination-controls">
                        <button
                          type="button"
                          className="admin-instructors-page-btn"
                          disabled={instructorsPage <= 1}
                          onClick={() => setInstructorsPage((prev) => Math.max(1, prev - 1))}
                        >
                          ‹
                        </button>
                        <span className="admin-instructors-page-indicator">
                          {instructorsPage} / {instructorsPageCount}
                        </span>
                        <button
                          type="button"
                          className="admin-instructors-page-btn"
                          disabled={instructorsPage >= instructorsPageCount}
                          onClick={() =>
                            setInstructorsPage((prev) => Math.min(instructorsPageCount, prev + 1))
                          }
                        >
                          ›
                        </button>
                        <div className="admin-instructors-page-jump">
                          <span className="admin-instructors-page-jump-label">Sayfaya git</span>
                          <input
                            type="number"
                            min={1}
                            max={instructorsPageCount}
                            className="admin-instructors-page-jump-input"
                            value={instructorsPageInput}
                            onChange={(event) => setInstructorsPageInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleGoToInstructorsPage();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="admin-instructors-page-jump-btn"
                            onClick={handleGoToInstructorsPage}
                          >
                            Git
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "announcements" ? (
            <Card className="admin-main-card">
              <CardContent className="admin-main-card-content admin-main-card-content--announcements">
                <div className="admin-main-card-header admin-main-card-header--announcements">
                  <div className="admin-announcements-header-left">
                    <h1 className="admin-main-card-title">Duyurular</h1>
                    <span className="admin-announcements-total-badge">
                      {`${announcementsTotalCount.toLocaleString("tr-TR")} TOPLAM`}
                    </span>
                  </div>
                  <div className="admin-announcements-header-actions">
                    <div className="admin-announcements-header-search">
                      <input
                        type="text"
                        className="admin-announcements-page-search-input"
                        value={announcementsSearchInput}
                        onChange={(event) => setAnnouncementsSearchInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleAnnouncementSearch();
                          }
                        }}
                        placeholder="Duyuru ara"
                      />
                      <button
                        type="button"
                        className="admin-announcements-page-jump-btn"
                        onClick={handleAnnouncementSearch}
                      >
                        Ara
                      </button>
                    </div>
                  </div>
                </div>

                {announcementsListLoading ? (
                  <div className="admin-announcements-empty">Yükleniyor...</div>
                ) : announcementsListError ? (
                  <div className="admin-announcements-empty">{announcementsListError}</div>
                ) : announcementsRows.length === 0 ? (
                  <div className="admin-announcements-empty">Duyuru bulunamadı.</div>
                ) : (
                  <>
                    <div className="admin-announcements-table-wrap">
                      <table className="admin-announcements-table">
                        <colgroup>
                          <col className="admin-announcements-col-title" />
                          <col className="admin-announcements-col-content" />
                          <col className="admin-announcements-col-link" />
                          <col className="admin-announcements-col-status" />
                          <col className="admin-announcements-col-date" />
                          <col className="admin-announcements-col-action" />
                          <col className="admin-announcements-col-action" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Başlık</th>
                            <th>İçerik</th>
                            <th>Link</th>
                            <th>Durum</th>
                            <th>Tarih</th>
                            <th>Düzenle</th>
                            <th>Sil</th>
                          </tr>
                        </thead>
                        <tbody>
                          {announcementsRows.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <span className="admin-announcements-table-clip" title={row.title}>
                                  {row.title}
                                </span>
                              </td>
                              <td>
                                <span className="admin-announcements-table-clip" title={row.contentPreview}>
                                  {row.contentPreview}
                                </span>
                              </td>
                              <td>
                                <span className="admin-announcements-table-clip" title={row.linkUrl}>
                                  {row.linkUrl}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={
                                    row.isActive
                                      ? "admin-announcements-status-badge admin-announcements-status-badge--active"
                                      : "admin-announcements-status-badge"
                                  }
                                >
                                  {row.isActive ? "Aktif" : "Pasif"}
                                </span>
                              </td>
                              <td>{row.createdAt}</td>
                              <td className="admin-announcements-table-action-cell">
                                <button
                                  type="button"
                                  className="admin-announcements-action-btn"
                                  onClick={() => handleOpenAnnouncementEdit(row.sourceRow)}
                                  aria-label="Duyuru düzenle"
                                >
                                  <PencilLine size={16} />
                                </button>
                              </td>
                              <td className="admin-announcements-table-action-cell">
                                <button
                                  type="button"
                                  className="admin-announcements-action-btn admin-announcements-action-btn--danger"
                                  onClick={() => handleRequestDeleteAnnouncement(row.id)}
                                  disabled={deletingAnnouncementId === row.id}
                                  aria-label="Duyuru sil"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="admin-announcements-pagination">
                      <p className="admin-announcements-pagination-info">
                        {`${announcementsVisibleRangeStart} - ${announcementsVisibleRangeEnd} / ${announcementsTotalCount} duyuru gösteriliyor`}
                      </p>
                      <div className="admin-announcements-pagination-controls">
                        <button
                          type="button"
                          className="admin-announcements-page-btn"
                          disabled={announcementsPage <= 1}
                          onClick={() => setAnnouncementsPage((prev) => Math.max(1, prev - 1))}
                        >
                          ‹
                        </button>
                        <span className="admin-announcements-page-indicator">
                          {announcementsPage} / {announcementsPageCount}
                        </span>
                        <button
                          type="button"
                          className="admin-announcements-page-btn"
                          disabled={announcementsPage >= announcementsPageCount}
                          onClick={() =>
                            setAnnouncementsPage((prev) =>
                              Math.min(announcementsPageCount, prev + 1)
                            )
                          }
                        >
                          ›
                        </button>
                        <div className="admin-announcements-page-jump">
                          <span className="admin-announcements-page-jump-label">Sayfaya git</span>
                          <input
                            type="number"
                            min={1}
                            max={announcementsPageCount}
                            className="admin-announcements-page-jump-input"
                            value={announcementsPageInput}
                            onChange={(event) => setAnnouncementsPageInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleGoToAnnouncementsPage();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="admin-announcements-page-jump-btn"
                            onClick={handleGoToAnnouncementsPage}
                          >
                            Git
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {editingIndividualUser ? (
            <div
              className="admin-individual-users-modal-overlay"
              role="presentation"
              onPointerDown={onBackdropPointerDown}
              onClick={getBackdropClickHandler(handleCloseIndividualUserEdit)}
            >
              <div
                className="admin-individual-users-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-individual-users-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="admin-individual-users-modal-header">
                  <h2 id="admin-individual-users-modal-title" className="admin-individual-users-modal-title">
                    Bireysel Kullanıcı Düzenle
                  </h2>
                  <button
                    type="button"
                    className="admin-individual-users-modal-close-btn"
                    onClick={handleCloseIndividualUserEdit}
                    disabled={individualUserEditSaving}
                    aria-label="Kapat"
                  >
                    <X size={18} />
                  </button>
                </div>
                <form
                  className="admin-individual-users-modal-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSaveIndividualUserEdit();
                  }}
                >
                  <label className="admin-individual-users-modal-field">
                    <span>Ad</span>
                    <input
                      type="text"
                      value={individualUserEditForm.firstName}
                      onChange={(event) =>
                        setIndividualUserEditForm((prev) => ({
                          ...prev,
                          firstName: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-individual-users-modal-field">
                    <span>Soyad</span>
                    <input
                      type="text"
                      value={individualUserEditForm.lastName}
                      onChange={(event) =>
                        setIndividualUserEditForm((prev) => ({
                          ...prev,
                          lastName: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-individual-users-modal-field">
                    <span>E-posta</span>
                    <input
                      type="email"
                      value={individualUserEditForm.email}
                      onChange={(event) =>
                        setIndividualUserEditForm((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-individual-users-modal-field">
                    <span>Telefon</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="05XX XXX XX XX"
                      value={individualUserEditForm.phone}
                      onChange={(event) => handleIndividualUserPhoneChange(event.target.value)}
                      aria-invalid={individualUserEditPhoneError ? true : undefined}
                      className={
                        individualUserEditPhoneError
                          ? "admin-individual-users-modal-field-input--error"
                          : undefined
                      }
                    />
                    {individualUserEditPhoneError ? (
                      <p className="admin-individual-users-modal-field-error">
                        {individualUserEditPhoneError}
                      </p>
                    ) : null}
                  </label>
                  {individualUserEditError ? (
                    <p className="admin-individual-users-modal-error">{individualUserEditError}</p>
                  ) : null}
                  <div className="admin-individual-users-modal-actions">
                    <button
                      type="button"
                      className="admin-individual-users-modal-cancel-btn"
                      onClick={handleCloseIndividualUserEdit}
                      disabled={individualUserEditSaving}
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      className="admin-individual-users-modal-save-btn"
                      disabled={individualUserEditSaving}
                    >
                      {individualUserEditSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {editingInstructor ? (
            <div
              className="admin-instructors-modal-overlay"
              role="presentation"
              onPointerDown={onBackdropPointerDown}
              onClick={getBackdropClickHandler(handleCloseInstructorEdit)}
            >
              <div
                className="admin-instructors-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-instructors-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="admin-instructors-modal-header">
                  <h2 id="admin-instructors-modal-title" className="admin-instructors-modal-title">
                    Bireysel Eğitmen Düzenle
                  </h2>
                  <button
                    type="button"
                    className="admin-instructors-modal-close-btn"
                    onClick={handleCloseInstructorEdit}
                    disabled={instructorEditSaving}
                    aria-label="Kapat"
                  >
                    <X size={18} />
                  </button>
                </div>
                <form
                  className="admin-instructors-modal-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSaveInstructorEdit();
                  }}
                >
                  <label className="admin-instructors-modal-field">
                    <span>Ad</span>
                    <input
                      type="text"
                      value={instructorEditForm.name}
                      onChange={(event) =>
                        setInstructorEditForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-instructors-modal-field">
                    <span>Soyad</span>
                    <input
                      type="text"
                      value={instructorEditForm.surname}
                      onChange={(event) =>
                        setInstructorEditForm((prev) => ({
                          ...prev,
                          surname: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-instructors-modal-field">
                    <span>E-posta</span>
                    <input
                      type="email"
                      value={instructorEditForm.email}
                      onChange={(event) =>
                        setInstructorEditForm((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-instructors-modal-field">
                    <span>Telefon</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="05XX XXX XX XX"
                      value={instructorEditForm.phone}
                      onChange={(event) => handleInstructorPhoneChange(event.target.value)}
                      aria-invalid={instructorEditPhoneError ? true : undefined}
                      className={
                        instructorEditPhoneError
                          ? "admin-instructors-modal-field-input--error"
                          : undefined
                      }
                    />
                    {instructorEditPhoneError ? (
                      <p className="admin-instructors-modal-field-error">
                        {instructorEditPhoneError}
                      </p>
                    ) : null}
                  </label>
                  <label className="admin-instructors-modal-field">
                    <span>Branş</span>
                    <input
                      type="text"
                      value={instructorEditForm.branch}
                      onChange={(event) =>
                        setInstructorEditForm((prev) => ({
                          ...prev,
                          branch: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-instructors-modal-field">
                    <span>İlçe</span>
                    <input
                      type="text"
                      value={instructorEditForm.district}
                      onChange={(event) =>
                        setInstructorEditForm((prev) => ({
                          ...prev,
                          district: event.target.value,
                        }))
                      }
                    />
                  </label>
                  {instructorEditError ? (
                    <p className="admin-instructors-modal-error">{instructorEditError}</p>
                  ) : null}
                  <div className="admin-instructors-modal-actions">
                    <button
                      type="button"
                      className="admin-instructors-modal-cancel-btn"
                      onClick={handleCloseInstructorEdit}
                      disabled={instructorEditSaving}
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      className="admin-instructors-modal-save-btn"
                      disabled={instructorEditSaving}
                    >
                      {instructorEditSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {editingAnnouncement ? (
            <div
              className="admin-announcements-modal-overlay"
              role="presentation"
              onPointerDown={onBackdropPointerDown}
              onClick={getBackdropClickHandler(handleCloseAnnouncementEdit)}
            >
              <div
                className="admin-announcements-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-announcements-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="admin-announcements-modal-header">
                  <h2 id="admin-announcements-modal-title" className="admin-announcements-modal-title">
                    Duyuru Düzenle
                  </h2>
                  <button
                    type="button"
                    className="admin-announcements-modal-close-btn"
                    onClick={handleCloseAnnouncementEdit}
                    disabled={announcementEditSaving}
                    aria-label="Kapat"
                  >
                    <X size={18} />
                  </button>
                </div>
                <form
                  className="admin-announcements-modal-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSaveAnnouncementEdit();
                  }}
                >
                  <label className="admin-announcements-modal-field">
                    <span>Başlık</span>
                    <input
                      type="text"
                      value={announcementEditForm.title}
                      onChange={(event) =>
                        setAnnouncementEditForm((prev) => ({
                          ...prev,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-announcements-modal-field">
                    <span>İçerik</span>
                    <textarea
                      rows={5}
                      value={announcementEditForm.content}
                      onChange={(event) =>
                        setAnnouncementEditForm((prev) => ({
                          ...prev,
                          content: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-announcements-modal-field">
                    <span>Görsel URL</span>
                    <input
                      type="url"
                      value={announcementEditForm.announcementImageUrl}
                      onChange={(event) =>
                        setAnnouncementEditForm((prev) => ({
                          ...prev,
                          announcementImageUrl: event.target.value,
                        }))
                      }
                      placeholder="https://"
                    />
                  </label>
                  <label className="admin-announcements-modal-field">
                    <span>Link URL</span>
                    <input
                      type="url"
                      value={announcementEditForm.linkUrl}
                      onChange={(event) =>
                        setAnnouncementEditForm((prev) => ({
                          ...prev,
                          linkUrl: event.target.value,
                        }))
                      }
                      placeholder="https://"
                    />
                  </label>
                  <label className="admin-announcements-modal-field admin-announcements-modal-field--checkbox">
                    <input
                      type="checkbox"
                      checked={announcementEditForm.isActive}
                      onChange={(event) =>
                        setAnnouncementEditForm((prev) => ({
                          ...prev,
                          isActive: event.target.checked,
                        }))
                      }
                    />
                    <span>Aktif</span>
                  </label>
                  {announcementEditError ? (
                    <p className="admin-announcements-modal-error">{announcementEditError}</p>
                  ) : null}
                  <div className="admin-announcements-modal-actions">
                    <button
                      type="button"
                      className="admin-announcements-modal-cancel-btn"
                      onClick={handleCloseAnnouncementEdit}
                      disabled={announcementEditSaving}
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      className="admin-announcements-modal-save-btn"
                      disabled={announcementEditSaving}
                    >
                      {announcementEditSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {activeTab === "blog-posts" ? (
            <Card className="admin-main-card">
              <CardContent className="admin-main-card-content admin-main-card-content--blog-posts">
                <div className="admin-main-card-header admin-main-card-header--blog-posts">
                  <div className="admin-blog-posts-header-left">
                    <h1 className="admin-main-card-title">Blog Yazıları</h1>
                    <span className="admin-blog-posts-total-badge">
                      {`${blogPostsTotalCount.toLocaleString("tr-TR")} TOPLAM`}
                    </span>
                  </div>
                  <div className="admin-blog-posts-header-actions">
                    <div className="admin-blog-posts-header-search">
                      <input
                        type="search"
                        className="admin-blog-posts-page-search-input"
                        value={blogPostsSearchInput}
                        onChange={(event) => setBlogPostsSearchInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleBlogPostsSearch();
                        }}
                        placeholder="Blog yazısı ara..."
                        aria-label="Blog yazısı ara"
                      />
                      <button
                        type="button"
                        className="admin-blog-posts-page-jump-btn"
                        onClick={handleBlogPostsSearch}
                      >
                        Ara
                      </button>
                    </div>
                  </div>
                </div>

                {blogPostsListLoading ? (
                  <div className="admin-blog-posts-empty">Yükleniyor...</div>
                ) : blogPostsListError ? (
                  <div className="admin-blog-posts-empty">{blogPostsListError}</div>
                ) : blogPostsRows.length === 0 ? (
                  <div className="admin-blog-posts-empty">Blog yazısı bulunamadı.</div>
                ) : (
                  <>
                    <div className="admin-blog-posts-table-wrap">
                      <table className="admin-blog-posts-table">
                        <colgroup>
                          <col className="admin-blog-posts-col-title" />
                          <col className="admin-blog-posts-col-author" />
                          <col className="admin-blog-posts-col-type" />
                          <col className="admin-blog-posts-col-date" />
                          <col className="admin-blog-posts-col-category" />
                          <col className="admin-blog-posts-col-action" />
                          <col className="admin-blog-posts-col-action" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Blog Yazısı Adı</th>
                            <th>Yayınlayan Adı</th>
                            <th>Yayınlayanın Üyelik Tipi</th>
                            <th>Yayınlanma Tarihi</th>
                            <th>Kategorisi</th>
                            <th>Düzenleme</th>
                            <th>Silme</th>
                          </tr>
                        </thead>
                        <tbody>
                          {blogPostsRows.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <span className="admin-blog-posts-table-clip" title={row.title}>
                                  {row.title}
                                </span>
                              </td>
                              <td>
                                <span className="admin-blog-posts-table-clip" title={row.authorName}>
                                  {row.authorName}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`admin-blog-posts-type-badge${
                                    row.authorType === "individual"
                                      ? " admin-blog-posts-type-badge--individual"
                                      : row.authorType === "instructor"
                                        ? " admin-blog-posts-type-badge--instructor"
                                        : ""
                                  }`}
                                  title={row.authorTypeLabel}
                                >
                                  {row.authorTypeLabel}
                                </span>
                              </td>
                              <td>{row.publishedDate}</td>
                              <td className="admin-blog-posts-table-category-cell">
                                <span
                                  className="admin-blog-posts-category-badge"
                                  title={
                                    row.categoryName !== "-" ? row.categoryName : undefined
                                  }
                                >
                                  {row.categoryName}
                                </span>
                              </td>
                              <td className="admin-blog-posts-table-action-cell">
                                <button
                                  type="button"
                                  className="admin-blog-posts-action-btn"
                                  aria-label="Blog yazısını düzenle"
                                  onClick={() => {
                                    const source = blogPostsList.find((item) => item.id === row.id);
                                    if (source) handleOpenBlogPostEdit(source);
                                  }}
                                >
                                  <PencilLine className="admin-blog-posts-action-icon" aria-hidden />
                                </button>
                              </td>
                              <td className="admin-blog-posts-table-action-cell">
                                <button
                                  type="button"
                                  className="admin-blog-posts-action-btn admin-blog-posts-action-btn--danger"
                                  aria-label="Blog yazısını sil"
                                  onClick={() => handleRequestDeleteBlogPost(row.id)}
                                  disabled={deletingBlogPostId === row.id}
                                >
                                  <Trash2 className="admin-blog-posts-action-icon" aria-hidden />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="admin-blog-posts-pagination">
                      <p className="admin-blog-posts-pagination-info">
                        {`${blogPostsVisibleRangeStart} - ${blogPostsVisibleRangeEnd} / ${blogPostsTotalCount} blog yazısı gösteriliyor`}
                      </p>
                      <div className="admin-blog-posts-pagination-controls">
                        <button
                          type="button"
                          className="admin-blog-posts-page-btn"
                          disabled={blogPostsPage <= 1}
                          onClick={() => setBlogPostsPage((prev) => Math.max(1, prev - 1))}
                        >
                          ‹
                        </button>
                        <span className="admin-blog-posts-page-indicator">
                          {blogPostsPage} / {blogPostsPageCount}
                        </span>
                        <button
                          type="button"
                          className="admin-blog-posts-page-btn"
                          disabled={blogPostsPage >= blogPostsPageCount}
                          onClick={() =>
                            setBlogPostsPage((prev) => Math.min(blogPostsPageCount, prev + 1))
                          }
                        >
                          ›
                        </button>
                        <div className="admin-blog-posts-page-jump">
                          <span className="admin-blog-posts-page-jump-label">Sayfaya git</span>
                          <input
                            type="number"
                            min={1}
                            max={blogPostsPageCount}
                            className="admin-blog-posts-page-jump-input"
                            value={blogPostsPageInput}
                            onChange={(event) => setBlogPostsPageInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleGoToBlogPostsPage();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="admin-blog-posts-page-jump-btn"
                            onClick={handleGoToBlogPostsPage}
                          >
                            Git
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {editingBlogPost ? (
            <div
              className="admin-blog-posts-modal-overlay"
              role="presentation"
              onPointerDown={onBackdropPointerDown}
              onClick={getBackdropClickHandler(handleCloseBlogPostEdit)}
            >
              <div
                className="admin-blog-posts-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-blog-posts-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="admin-blog-posts-modal-header">
                  <h2 id="admin-blog-posts-modal-title" className="admin-blog-posts-modal-title">
                    Blog Yazısı Düzenle
                  </h2>
                  <button
                    type="button"
                    className="admin-blog-posts-modal-close-btn"
                    onClick={handleCloseBlogPostEdit}
                    disabled={blogPostEditSaving}
                    aria-label="Kapat"
                  >
                    <X size={18} />
                  </button>
                </div>
                <form
                  className="admin-blog-posts-modal-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSaveBlogPostEdit();
                  }}
                >
                  <label className="admin-blog-posts-modal-field">
                    <span>Başlık</span>
                    <input
                      type="text"
                      value={blogPostEditForm.title}
                      onChange={(event) =>
                        setBlogPostEditForm((prev) => ({
                          ...prev,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-blog-posts-modal-field">
                    <span>İçerik</span>
                    <textarea
                      rows={5}
                      value={blogPostEditForm.content}
                      onChange={(event) =>
                        setBlogPostEditForm((prev) => ({
                          ...prev,
                          content: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-blog-posts-modal-field">
                    <span>Kategori</span>
                    <select
                      value={blogPostEditForm.categoryId}
                      onChange={(event) =>
                        setBlogPostEditForm((prev) => ({
                          ...prev,
                          categoryId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Kategori seçin</option>
                      {blogCategoryOptions.map((option) => (
                        <option key={option.id} value={String(option.id)}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-blog-posts-modal-field">
                    <span>Kapak Görseli URL</span>
                    <input
                      type="url"
                      value={blogPostEditForm.coverImageUrl}
                      onChange={(event) =>
                        setBlogPostEditForm((prev) => ({
                          ...prev,
                          coverImageUrl: event.target.value,
                        }))
                      }
                      placeholder="https://"
                    />
                  </label>
                  <label className="admin-blog-posts-modal-field admin-blog-posts-modal-field--checkbox">
                    <input
                      type="checkbox"
                      checked={blogPostEditForm.isPublished}
                      onChange={(event) =>
                        setBlogPostEditForm((prev) => ({
                          ...prev,
                          isPublished: event.target.checked,
                        }))
                      }
                    />
                    <span>Yayında</span>
                  </label>
                  {blogPostEditError ? (
                    <p className="admin-blog-posts-modal-error">{blogPostEditError}</p>
                  ) : null}
                  <div className="admin-blog-posts-modal-actions">
                    <button
                      type="button"
                      className="admin-blog-posts-modal-cancel-btn"
                      onClick={handleCloseBlogPostEdit}
                      disabled={blogPostEditSaving}
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      className="admin-blog-posts-modal-save-btn"
                      disabled={blogPostEditSaving}
                    >
                      {blogPostEditSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {activeTab === "settings" ? <ChangePasswordCard /> : null}

          {activeTab !== "overview" &&
          activeTab !== "institutions" &&
          activeTab !== "users" &&
          activeTab !== "instructors" &&
          activeTab !== "announcements" &&
          activeTab !== "blog-posts" &&
          activeTab !== "settings" ? (
            <Card className="admin-main-card">
              <CardContent className="admin-main-card-content">
                <div className="admin-main-card-header">
                  <h1 className="admin-main-card-title">{activeTabTitle}</h1>
                  <p className="admin-main-card-subtitle">
                    Bu sekme yakında yönetim aksiyonlarıyla genişletilecektir.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={deleteConfirmTarget !== null}
        title={deleteConfirmModal?.title ?? ""}
        message={deleteConfirmModal?.message ?? ""}
        error={deleteConfirmError}
        confirmLabel={deleteConfirmModal?.confirmLabel ?? "Sil"}
        loading={deleteConfirmModal?.loading ?? false}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={handleCancelDeleteConfirm}
      />
    </div>
  );
}

