import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

/**
 * Wraps a field with drag-and-drop sortable behavior and a grip handle.
 * Used by both CreateNewLesson and CreateNewLessonType.
 */
export default function SortableField({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ position: 'relative' }}>
        <div
          {...attributes}
          {...listeners}
          style={{
            position: 'absolute',
            left: '-2rem',
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'grab',
            color: '#8b5cf6',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#6d28d9')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#8b5cf6')}
          title="Drag to reorder"
        >
          <GripVertical size={20} />
        </div>
        {children}
      </div>
    </div>
  );
}
