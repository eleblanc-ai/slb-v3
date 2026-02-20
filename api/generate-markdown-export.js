/**
 * API endpoint to generate markdown export file for a lesson template
 * This creates the necessary file and updates CreateNewLesson.jsx with imports
 */

import fs from 'fs';
import path from 'path';

// Convert template name to camelCase for file naming
function templateNameToCamelCase(name) {
  return name
    .split(' ')
    .map((word, index) => {
      const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
      if (index === 0) {
        return cleanWord.toLowerCase();
      }
      return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
    })
    .join('');
}

// Generate import statement
function generateImportStatement(templateName) {
  const camelCaseName = templateNameToCamelCase(templateName);
  return `import { generateMarkdown as generate${camelCaseName.charAt(0).toUpperCase() + camelCaseName.slice(1)}Markdown } from '../../export/templates/${camelCaseName}MarkdownExport';`;
}

// Generate map entry
function generateMapEntry(templateName) {
  const camelCaseName = templateNameToCamelCase(templateName);
  const functionName = `generate${camelCaseName.charAt(0).toUpperCase() + camelCaseName.slice(1)}Markdown`;
  return `  '${templateName}': ${functionName},`;
}

// Generate file content
function generateMarkdownExportFileContent(templateName) {
  return `/**
 * Markdown Export for ${templateName} Lesson Template
 * Auto-generated export function for lesson content
 */

export function generateMarkdown(templateData, fields, fieldValues) {
  let markdown = \`# \${templateData?.name || 'Lesson'}\\n\\n\`;
  
  // Add designer fields
  const designerFields = fields.filter(f => f.fieldFor === 'designer');
  if (designerFields.length > 0) {
    markdown += \`## Designer Fields\\n\\n\`;
    designerFields.forEach(field => {
      const value = fieldValues[field.id];
      markdown += \`### \${field.name}\${field.required ? ' *' : ''}\\n\\n\`;
      
      if (field.type === 'checklist' && Array.isArray(value)) {
        value.forEach(item => {
          markdown += \`- \${item}\\n\`;
        });
        markdown += \`\\n\`;
      } else if (field.type === 'mcqs' && value?.questions) {
        value.questions.forEach((q, idx) => {
          if (q) {
            const cleanQuestion = q.replace(/<[^>]*>/g, '\\n').trim();
            markdown += \`**Question \${idx + 1}:**\\n\${cleanQuestion}\\n\\n\`;
          }
        });
      } else if (field.type === 'rich_text' || field.type === 'text') {
        const textValue = typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim() : '';
        markdown += \`\${textValue || '_No content_'}\\n\\n\`;
      } else if (field.type === 'image' && value?.url) {
        markdown += \`![\${field.name}](\${value.url})\\n\\n\`;
        if (value.altText) {
          markdown += \`_\${value.altText}_\\n\\n\`;
        }
      } else {
        markdown += \`\${value || '_No content_'}\\n\\n\`;
      }
    });
  }
  
  // Add builder fields
  const builderFields = fields.filter(f => f.fieldFor === 'builder');
  if (builderFields.length > 0) {
    markdown += \`## Builder Fields\\n\\n\`;
    builderFields.forEach(field => {
      const value = fieldValues[field.id];
      markdown += \`### \${field.name}\${field.required ? ' *' : ''}\\n\\n\`;
      
      if (field.type === 'checklist' && Array.isArray(value)) {
        value.forEach(item => {
          markdown += \`- \${item}\\n\`;
        });
        markdown += \`\\n\`;
      } else if (field.type === 'mcqs' && value?.questions) {
        value.questions.forEach((q, idx) => {
          if (q) {
            const cleanQuestion = q.replace(/<[^>]*>/g, '\\n').trim();
            markdown += \`**Question \${idx + 1}:**\\n\${cleanQuestion}\\n\\n\`;
          }
        });
      } else if (field.type === 'rich_text' || field.type === 'text') {
        const textValue = typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim() : '';
        markdown += \`\${textValue || '_No content_'}\\n\\n\`;
      } else if (field.type === 'image' && value?.url) {
        markdown += \`![\${field.name}](\${value.url})\\n\\n\`;
        if (value.altText) {
          markdown += \`_\${value.altText}_\\n\\n\`;
        }
      } else {
        markdown += \`\${value || '_No content_'}\\n\\n\`;
      }
    });
  }
  
  return markdown;
}
`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { templateName } = req.body;

    if (!templateName) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const camelCaseName = templateNameToCamelCase(templateName);
    const fileName = `${camelCaseName}MarkdownExport.js`;
    
    // Generate the markdown export file
    const fileContent = generateMarkdownExportFileContent(templateName);
    const projectRoot = path.join(process.cwd());
    const exportFilePath = path.join(projectRoot, 'src', 'lib', 'markdown-export', fileName);
    
    // Ensure directory exists
    const exportDir = path.dirname(exportFilePath);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Create the file
    fs.writeFileSync(exportFilePath, fileContent, 'utf8');
    console.log(`✅ Created: ${fileName}`);

    // Update CreateNewLesson.jsx with the import and map entry
    const createNewLessonPath = path.join(projectRoot, 'src', 'components', 'pages', 'CreateNewLesson.jsx');
    let createNewLessonContent = fs.readFileSync(createNewLessonPath, 'utf8');

    // Add import statement after the last markdown export import
    const importStatement = generateImportStatement(templateName);
    const importRegex = /(import { generateMarkdown as generate\w+Markdown } from '\.\.\/\.\.\/lib\/markdown-export\/\w+MarkdownExport';)/g;
    const imports = createNewLessonContent.match(importRegex);
    
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      createNewLessonContent = createNewLessonContent.replace(
        lastImport,
        `${lastImport}\n${importStatement}`
      );
    }

    // Add map entry in the templateNameToFunctionMap
    const mapEntry = generateMapEntry(templateName);
    const mapRegex = /(const templateNameToFunctionMap = \{[\s\S]*?)(\s+\/\/ Future templates will be added here automatically)/;
    createNewLessonContent = createNewLessonContent.replace(
      mapRegex,
      `$1\n${mapEntry}$2`
    );

    // Write the updated file
    fs.writeFileSync(createNewLessonPath, createNewLessonContent, 'utf8');
    console.log(`✅ Updated CreateNewLesson.jsx with ${templateName}`);

    return res.status(200).json({ 
      success: true, 
      fileName,
      message: `Markdown export file created for "${templateName}"` 
    });

  } catch (error) {
    console.error('Error generating markdown export file:', error);
    return res.status(500).json({ 
      error: 'Failed to generate markdown export file',
      details: error.message 
    });
  }
}
