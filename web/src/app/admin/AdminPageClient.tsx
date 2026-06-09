"use client";

import { useEffect, useMemo, useState } from "react";
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
  X,
} from "lucide-react";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { Card, CardContent } from "@/components/ui";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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

type IndividualUserListRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  auth_user_id: string | null;
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

type DeleteConfirmTarget =
  | { type: "individual-user"; id: number }
  | { type: "institution"; id: number }
  | { type: "instructor"; id: number };

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
      title: "Bireysel Eğitmenler",
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
        institutionsQuery = institutionsQuery.ilike("institution_name", `%${normalizedSearch}%`);
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
        .select("id, first_name, last_name, email, auth_user_id", { count: "exact" })
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
        instructorsQuery = instructorsQuery.or(
          `name.ilike.%${normalizedSearch}%,surname.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%,branch.ilike.%${normalizedSearch}%,district.ilike.%${normalizedSearch}%`
        );
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

  useEffect(() => {
    setInstitutionsPageInput(String(institutionsPage));
  }, [institutionsPage]);

  useEffect(() => {
    setIndividualUsersPageInput(String(individualUsersPage));
  }, [individualUsersPage]);

  useEffect(() => {
    setInstructorsPageInput(String(instructorsPage));
  }, [instructorsPage]);

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
      deletingInstructorId !== null
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
  ]);

  const activeTabTitle =
    activeTab === "users"
      ? "Bireysel Kullanıcılar"
      : activeTab === "instructors"
        ? "Bireysel Eğitmenler"
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
                <span>Bireysel Eğitmenler</span>
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
                    <h1 className="admin-main-card-title">Bireysel Eğitmenler</h1>
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

          {editingIndividualUser ? (
            <div
              className="admin-individual-users-modal-overlay"
              role="presentation"
              onClick={handleCloseIndividualUserEdit}
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
              onClick={handleCloseInstructorEdit}
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

          {activeTab === "settings" ? <ChangePasswordCard /> : null}

          {activeTab !== "overview" &&
          activeTab !== "institutions" &&
          activeTab !== "users" &&
          activeTab !== "instructors" &&
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

