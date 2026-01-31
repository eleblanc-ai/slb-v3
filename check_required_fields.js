// Quick script to check required_for_generation values in Supabase
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables. Make sure .env file has:');
  console.error('VITE_SUPABASE_URL=...');
  console.error('VITE_SUPABASE_ANON_KEY=...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFields() {
  try {
    const { data: fields, error } = await supabase
      .from('lesson_template_fields')
      .select('id, name, field_type, required_for_generation, lesson_template_id')
      .order('lesson_template_id', { ascending: true });
    
    if (error) throw error;
    
    console.log('\n=== Fields with required_for_generation status ===\n');
    
    let currentTemplateId = null;
    fields.forEach(field => {
      if (currentTemplateId !== field.lesson_template_id) {
        currentTemplateId = field.lesson_template_id;
        console.log(`\n--- Template ID: ${field.lesson_template_id} ---`);
      }
      console.log(`${field.name} (${field.field_type}): required_for_generation = ${field.required_for_generation}`);
    });
    
    console.log('\n\n=== Summary ===');
    const trueCount = fields.filter(f => f.required_for_generation === true).length;
    const falseCount = fields.filter(f => f.required_for_generation === false).length;
    const nullCount = fields.filter(f => f.required_for_generation === null).length;
    
    console.log(`True: ${trueCount}`);
    console.log(`False: ${falseCount}`);
    console.log(`Null: ${nullCount}`);
    console.log(`Total: ${fields.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkFields();
