// Regenerates src/lib/database.types.ts from the LIVE Supabase project.
//
// Run with `npm run types:gen`, after a one-time `npx supabase login` and
// `npx supabase link --project-ref <ref>`.
//
// The CLI version is pinned to match .github/workflows/migrations.yml, so the
// types the app compiles against and the CLI that applies migrations never
// disagree. `gen types` emits no header of its own, so one is prepended here —
// without it the file reads as hand-editable, which is how it drifted before.

import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const CLI = 'supabase@2.116.0'
const OUT = 'src/lib/database.types.ts'

const header = `// GENERATED — do not edit by hand.
//
// Regenerate with \`npm run types:gen\` (needs \`supabase link\` once).
// This mirrors the live database, which is the point: it is what catches the
// schema drifting away from supabase/migrations/. The curated aliases the app
// actually imports live in ./types.ts.

`

console.log(`Generating ${OUT} from the linked project…`)
const generated = execSync(`npx --yes ${CLI} gen types typescript --linked`, {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'inherit'],
})

if (!generated.includes('export type Database')) {
  console.error('Refusing to write: output does not look like generated types.')
  process.exit(1)
}

writeFileSync(OUT, header + generated)
console.log(`Wrote ${OUT} (${generated.split('\n').length} generated lines).`)
