import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Resolve the Tailwind config relative to this file so the dev server works
// even when started from the repository root (npm run dev --prefix frontend).
const here = path.dirname(fileURLToPath(import.meta.url))

export default {
  plugins: {
    tailwindcss: { config: path.join(here, 'tailwind.config.js') },
    autoprefixer: {},
  },
}
