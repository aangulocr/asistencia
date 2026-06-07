
// vitest-setup.ts
import '@testing-library/jest-dom';

// Mock environment variables for Supabase
process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
process.env.VITE_SUPABASE_ANON_KEY = 'test-key';
