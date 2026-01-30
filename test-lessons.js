import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aaqrshoqcmawtuncbwln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhcXJzaG9xY21hd3R1bmNid2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MjE3NjQsImV4cCI6MjA4NTI5Nzc2NH0.BkSbbML2tr-9lvAYLiR388gNv7uP1DyfljTP0GnJj7w'
);

async function testLessons() {
  console.log('Testing lessons query...\n');
  
  const { data, error, count } = await supabase
    .from('lessons')
    .select('*', { count: 'exact' });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Count:', count);
    console.log('Lessons found:', data?.length);
    if (data && data.length > 0) {
      console.log('\nFirst lesson:');
      console.log(JSON.stringify(data[0], null, 2));
    }
  }
}

testLessons();
