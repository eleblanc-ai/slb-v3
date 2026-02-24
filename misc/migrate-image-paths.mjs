/**
 * Migration script: Rename lesson images from {templateName}/{contentId}.png → {lessonId}.png
 * 
 * Usage:  node misc/migrate-image-paths.mjs
 * 
 * Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 * (service role key needed for storage admin operations — NOT the anon key).
 * 
 * Dry-run by default. Set DRY_RUN=false to actually move files:
 *   DRY_RUN=false node --env-file=.env misc/migrate-image-paths.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN !== 'false';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = 'lesson-images';

async function main() {
  console.log(`\n=== Image Path Migration (${DRY_RUN ? 'DRY RUN' : 'LIVE'}) ===\n`);

  // 1. List all current objects in the bucket (top-level + nested)
  const allFiles = [];

  // List top-level folders/files
  const { data: topLevel, error: listErr } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
  if (listErr) { console.error('Error listing bucket:', listErr); return; }

  for (const item of topLevel) {
    if (item.id) {
      // It's a file at the root
      allFiles.push(item.name);
    } else {
      // It's a folder — list its contents
      const { data: nested } = await supabase.storage.from(BUCKET).list(item.name, { limit: 1000 });
      if (nested) {
        for (const file of nested) {
          if (file.id) allFiles.push(`${item.name}/${file.name}`);
        }
      }
    }
  }

  console.log(`Found ${allFiles.length} file(s) in bucket "${BUCKET}":\n`);
  allFiles.forEach(f => console.log(`  ${f}`));
  console.log('');

  // 2. Query all lessons that have image URLs pointing to this bucket
  const { data: lessons, error: lessonErr } = await supabase
    .from('lessons')
    .select('id, template_name, designer_responses, builder_responses');
  if (lessonErr) { console.error('Error fetching lessons:', lessonErr); return; }

  console.log(`Found ${lessons.length} lesson(s). Scanning for image field values...\n`);

  let moved = 0;
  let skipped = 0;
  let errors = 0;

  for (const lesson of lessons) {
    // Scan both response JSONB blobs for image objects (have a .url property pointing to the bucket)
    const allResponses = { ...lesson.designer_responses, ...lesson.builder_responses };

    for (const [fieldName, val] of Object.entries(allResponses)) {
      if (!val || typeof val !== 'object' || !val.url) continue;
      if (!val.url.includes(BUCKET)) continue;

      // Extract the current storage path from the URL
      // URL format: https://<project>.supabase.co/storage/v1/object/public/lesson-images/<path>?t=...
      const urlObj = new URL(val.url);
      const pathPrefix = `/storage/v1/object/public/${BUCKET}/`;
      const idx = urlObj.pathname.indexOf(pathPrefix);
      if (idx === -1) continue;

      const currentPath = decodeURIComponent(urlObj.pathname.slice(idx + pathPrefix.length));
      const newPath = `${lesson.id}.png`;

      if (currentPath === newPath) {
        console.log(`  ✅ ${lesson.id} — "${fieldName}" already at ${newPath}`);
        skipped++;
        continue;
      }

      console.log(`  🔄 ${lesson.id} — "${fieldName}"`);
      console.log(`     Old: ${currentPath}`);
      console.log(`     New: ${newPath}`);

      if (!DRY_RUN) {
        // Move the file
        const { error: moveErr } = await supabase.storage.from(BUCKET).move(currentPath, newPath);
        if (moveErr) {
          console.log(`     ❌ Move failed: ${moveErr.message}`);
          errors++;
          continue;
        }

        // Get the new public URL
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(newPath);
        const newUrl = `${publicUrl}?t=${Date.now()}`;

        // Update the lesson responses with the new URL
        const responseColumn = lesson.designer_responses?.[fieldName]?.url
          ? 'designer_responses'
          : 'builder_responses';

        const updatedResponses = { ...lesson[responseColumn] };
        updatedResponses[fieldName] = { ...updatedResponses[fieldName], url: newUrl };

        const { error: updateErr } = await supabase
          .from('lessons')
          .update({ [responseColumn]: updatedResponses })
          .eq('id', lesson.id);

        if (updateErr) {
          console.log(`     ❌ DB update failed: ${updateErr.message}`);
          errors++;
          continue;
        }

        console.log(`     ✅ Moved & updated`);
      }

      moved++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Moved:   ${moved}`);
  console.log(`  Skipped: ${skipped} (already correct)`);
  console.log(`  Errors:  ${errors}`);
  if (DRY_RUN && moved > 0) {
    console.log(`\n  This was a DRY RUN. To apply changes, run:`);
    console.log(`  DRY_RUN=false node misc/migrate-image-paths.mjs\n`);
  }
}

main().catch(console.error);
