import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';

/**
 * Handles GET requests to test the database connection
 * @returns A response indicating whether the database connection was successful
 */
export async function GET() {
  try {
    await dbConnect();
    return NextResponse.json({ success: true, message: 'Database connection successful' });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { success: false, message: 'Database connection failed', error: (error as Error).message },
      { status: 500 }
    );
  }
} 