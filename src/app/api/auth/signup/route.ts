import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/lib/models/user';

/**
 * Handles POST requests for user signup
 * @param request - The incoming request object
 * @returns A response indicating whether the signup was successful
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Signup API called');
    const { name, email, password } = await request.json();
    console.log('Received signup data:', { name, email, passwordLength: password?.length });

    // Validate input
    if (!name || !email || !password) {
      console.log('Missing required fields');
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    await dbConnect();
    console.log('Connected to database');

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    console.log('Existing user check:', { exists: !!existingUser });
    
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Create new user
    console.log('Creating new user');
    const user = await User.create({
      name,
      email,
      password
    });
    console.log('User created successfully:', user._id);

    // Return success without exposing sensitive data
    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Signup error details:', error);
    return NextResponse.json(
      { success: false, message: 'Signup failed', error: (error as Error).message },
      { status: 500 }
    );
  }
} 