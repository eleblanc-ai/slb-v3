/**
 * Migration script: Reorganize lesson images into template folders
 * Moves {lessonId}.png → {templateName}/{lessonId}.png
 * 
 * Usage:  node --env-file=.env misc/reorganize-image-paths.mjs
 * 
 * Dry-run by default. Set DRY_RUN=false to actually move files:
 *   DRY_RUN=false node --env-file=.env misc/reorganize-image-paths.mjs
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
  console.log(`\n=== Reorganize Images into Template Folders (${DRY_RUN ? 'DRY RUN' : 'LIVE'}) ===\n`);

  // 1. Get all lessons with their template names
  const { data: lessons, error: lessonErr } = await supabase
    .from('lessons')
    .select('id, template_name, designer_responses, builder_responses');
  if (lessonErr) { console.error('Error fetching lessons:', lessonErr); return; }

  console.log(`Found ${lessons.length} lesson(s). Scanning for images to reorganize...\n`);

  let moved = 0;
  let skipped = 0;
  let errors = 0;

  for (const lesson of lessons) {
    const templateName = lesson.template_name;
    if (!templateName) {
      console.log(`  ⚠️  ${lesson.id} — no template_name, skipping`);
      skipped++;
      continue;
    }

    // Scan both response blobs for image fields
    const allResponses = { ...lesson.designer_responses, ...lesson.builder_responses };

    for (const [fieldName, val] of Object.entries(allResponses)) {
      if (!val || typeof val !== 'object' || !val.url) continue;
      if (!val.url.includes(BUCKET)) continue;

      // Extract current storage path from URL
      const urlObj = new URL(val.url);
      const pathPrefix = `/storage/v1/object/public/${BUCKET}/`;
      const idx = urlObj.pathname.indexOf(pathPrefix);
      if (idx === -1) continue;

      const currentPath = decodeURIComponent(urlObj.pathname.slice(idx + pathPrefix.length));
      const expectedPath = `${templateName}/${lesson.id}.png`;

      if (currentPath === expectedPath) {
        console.log(`  ✅ ${lesson.id} — "${fieldName}" already at ${expectedPath}`);
        skipped++;
        continue;
      }

      console.log(`  🔄 ${lesson.id} — "${fieldName}"`);
      console.log(`     Template: ${templateName}`);
      console.log(`     Old: ${currentPath}`);
      console.log(`     New: ${expectedPath}`);

      if (!DRY_RUN) {
        // Move the file
        const { error: moveErr } = await supabase.storage.from(BUCKET).move(currentPath, expectedPath);
        if (moveErr) {
          console.log(`     ❌ Move failed: ${moveErr.message}`);
          errors++;
          continue;
        }

        // Get the new public URL
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(expectedPath);
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
  console.log(`  Skipped: ${skipped} (already correct or no template)`);
  console.log(`  Errors:  ${errors}`);
  if (DRY_RUN && moved > 0) {
    console.log(`\n  This was a DRY RUN. To apply changes, run:`);
    console.log(`  DRY_RUN=false node --env-file=.env misc/reorganize-image-paths.mjs\n`);
  }
}

main().catch(console.error);
