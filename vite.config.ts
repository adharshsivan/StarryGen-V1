import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Vercel injects environment variables into process.env.
  // We check for VITE_API_KEY first, then API_KEY, checking both the loaded env and the system process.env.
  let apiKey = env.VITE_API_KEY || env.API_KEY || process.env.VITE_API_KEY || process.env.API_KEY;

  // Sanitize: Remove wrapping quotes if user added them in Vercel UI (common mistake)
  if (apiKey) {
      apiKey = apiKey.replace(/^['"](.*)['"]$/, '$1');
  }

  // Debug log for build output (Masked for security)
  if (!apiKey) {
      console.warn("⚠️  WARNING: API_KEY is missing in the build environment! The app will likely fail at runtime.");
  } else {
      console.log(`✅ API_KEY found in build environment (Length: ${apiKey.length}, Starts with: ${apiKey.substring(0, 4)}...)`);
  }

  return {
    plugins: [react()],
    define: {
      // This ensures code using process.env.API_KEY works in the browser.
      'process.env.API_KEY': JSON.stringify(apiKey || ""),
    },
  };
});