import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import { useEffect } from 'react';
import {
  Heading2,
  Heading3,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from 'lucide-react';

// Helper to convert plain text newlines to HTML
function convertNewlinesToHTML(text) {
  if (!text) return text;
  
  // If it already contains HTML tags, return as-is
  if (/<[^>]+>/.test(text)) {
    return text;
  }
  
  // Convert plain text with newlines to paragraphs
  return text
    .split('\n\n')  // Split by double newlines (paragraphs)
    .filter(para => para.trim())  // Remove empty paragraphs
    .map(para => {
      // For each paragraph, convert single newlines to <br>
      const withBreaks = para.split('\n').join('<br>');
      return `<p>${withBreaks}</p>`;
    })
    .join('');
}

export default function TipTapEditor({ content = '', onChange, placeholder = 'Enter text...' }) {
  // Suppress TipTap duplicate extension warnings
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args[0]?.includes?.('Duplicate') && args[0]?.includes?.('extension')) {
      return;
    }
    originalWarn(...args);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Heading.configure({ 
        levels: [2, 3] 
      }),
      Underline,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
  }, [placeholder]);

  // Update editor content when external content changes (e.g., from AI generation)
  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      const htmlContent = convertNewlinesToHTML(content);
      editor.commands.setContent(htmlContent);
    }
  }, [content, editor]);

  // Restore original console.warn
  console.warn = originalWarn;

  return (
    <div style={{
      border: '2px solid var(--gray-200)',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#fff'
    }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.25rem',
        padding: '0.5rem',
        borderBottom: '1px solid var(--gray-200)',
        backgroundColor: 'var(--gray-50)'
      }}>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          style={{
            padding: '0.375rem 0.5rem',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: editor?.isActive('heading', { level: 2 }) ? 'var(--primary)' : 'transparent',
            color: editor?.isActive('heading', { level: 2 }) ? '#fff' : 'var(--gray-700)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
          title="Heading 2"
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          style={{
            padding: '0.375rem 0.5rem',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: editor?.isActive('heading', { level: 3 }) ? 'var(--primary)' : 'transparent',
            color: editor?.isActive('heading', { level: 3 }) ? '#fff' : 'var(--gray-700)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
          title="Heading 3"
        >
          <Heading3 size={16} />
        </button>
        <div style={{ width: '1px', backgroundColor: 'var(--gray-300)', margin: '0 0.25rem' }} />
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          style={{
            padding: '0.375rem 0.5rem',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: editor?.isActive('bold') ? 'var(--primary)' : 'transparent',
            color: editor?.isActive('bold') ? '#fff' : 'var(--gray-700)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
          title="Bold"
        >
          <BoldIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          style={{
            padding: '0.375rem 0.5rem',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: editor?.isActive('italic') ? 'var(--primary)' : 'transparent',
            color: editor?.isActive('italic') ? '#fff' : 'var(--gray-700)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
          title="Italic"
        >
          <ItalicIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          style={{
            padding: '0.375rem 0.5rem',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: editor?.isActive('underline') ? 'var(--primary)' : 'transparent',
            color: editor?.isActive('underline') ? '#fff' : 'var(--gray-700)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
          title="Underline"
        >
          <UnderlineIcon size={16} />
        </button>
        <div style={{ width: '1px', backgroundColor: 'var(--gray-300)', margin: '0 0.25rem' }} />
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          style={{
            padding: '0.375rem 0.5rem',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: editor?.isActive('bulletList') ? 'var(--primary)' : 'transparent',
            color: editor?.isActive('bulletList') ? '#fff' : 'var(--gray-700)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          style={{
            padding: '0.375rem 0.5rem',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: editor?.isActive('orderedList') ? 'var(--primary)' : 'transparent',
            color: editor?.isActive('orderedList') ? '#fff' : 'var(--gray-700)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
        <div style={{ width: '1px', backgroundColor: 'var(--gray-300)', margin: '0 0.25rem' }} />
        <button
          type="button"
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor?.can().chain().undo().run()}
          style={{
            padding: '0.375rem 0.5rem',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            color: editor?.can().chain().undo().run() ? 'var(--gray-700)' : 'var(--gray-400)',
            cursor: editor?.can().chain().undo().run() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
          title="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor?.can().chain().redo().run()}
          style={{
            padding: '0.375rem 0.5rem',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            color: editor?.can().chain().redo().run() ? 'var(--gray-700)' : 'var(--gray-400)',
            cursor: editor?.can().chain().redo().run() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
          title="Redo"
        >
          <Redo2 size={16} />
        </button>
      </div>
      <div style={{ 
        minHeight: '120px',
        padding: '0.75rem 1rem',
        fontSize: '1rem'
      }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
