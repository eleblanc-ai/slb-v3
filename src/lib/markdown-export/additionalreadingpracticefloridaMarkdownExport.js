/**
 * Markdown Export for Additional Reading Practice (Florida)
 */

export function generateMarkdown(templateData, fields, fieldValues) {
  let markdown = '';
  
  // Helper to get field value by name
  const getFieldValue = (fieldName) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return '';
    return fieldValues[field.id] || '';
  };
  
  // TODO: Build your markdown output here
  // Use getFieldValue('Field Name') to access values
  
  return markdown;
}