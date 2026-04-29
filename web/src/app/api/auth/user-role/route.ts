import { NextResponse } from 'next/server';
import { getCurrentUserRole } from '@/lib/auth/authServer';

export async function GET() {
  try {
    const { user, userType, isAdmin } = await getCurrentUserRole();
    return NextResponse.json({ user, userType, isAdmin });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[user-role API] Error:', error);
    }
    return NextResponse.json({ user: null, userType: null, isAdmin: false }, { status: 200 });
  }
}
