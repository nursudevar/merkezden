import { NextResponse } from 'next/server';
import { getCurrentUserRole } from '@/lib/auth/getCurrentUserRole';

export async function GET() {
  try {
    const { user, userType } = await getCurrentUserRole();
    return NextResponse.json({ user, userType });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[user-role API] Error:', error);
    }
    return NextResponse.json({ user: null, userType: null }, { status: 200 });
  }
}
