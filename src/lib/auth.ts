import { authOptions as importedAuthOptions } from './auth-options';
import { NextAuthOptions } from 'next-auth';

// Re-export the imported auth options
export const authOptions = importedAuthOptions;

export default authOptions; 