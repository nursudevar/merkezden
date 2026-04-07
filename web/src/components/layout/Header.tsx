import { unstable_noStore as noStore } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/authServer";
import { HeaderWithSearchClient } from "./header.client";

export default async function Header() {
  noStore();
  const { user, userType } = await getCurrentUserRole();

  return (
    <HeaderWithSearchClient
      user={user ? { id: user.id, email: user.email ?? undefined } : null}
      userType={userType}
    />
  );
}
