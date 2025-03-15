'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * AuthProvider component that wraps the application with NextAuth's SessionProvider
 * Makes session data available throughout the application
 * @param children - Child components to be wrapped
 */
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  return <SessionProvider>{children}</SessionProvider>;
};

export default AuthProvider; 