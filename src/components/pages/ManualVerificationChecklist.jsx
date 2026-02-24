import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Check, ChevronDown, ChevronRight, RotateCcw, ClipboardList,
  Save, History, ArrowLeft, Trash2, Eye, FileText,
  Plus, Pencil, GripVertical, X, AlertCircle,
} from 'lucide-react';
import TipTapEditor from '../core/TipTapEditor';
import { supabase } from '../../services/supabaseClient';

// ── Storage keys ────────────────────────────────────────────────────
const CURRENT_KEY = 'mvc-current';
const HISTORY_KEY = 'mvc-history';
const NOTES_KEY = 'mvc-notes';

// ── Helpers ─────────────────────────────────────────────────────────
const countChecked = (map) => Object.values(map || {}).filter(Boolean).length;
const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
const loadJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
};

// ── Component ───────────────────────────────────────────────────────
export default function ManualVerificationChecklist() {
  const { session, profile } = useOutletContext() || {};
  const testerName = profile?.display_name || profile?.email || 'Unknown';
  const isAdmin = profile?.role === 'admin';

  // ── Checklist data from Supabase ────────────────────────────────
  const [sections, setSections] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const scrollRestoreRef = useRef(null);

  const loadChecklist = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const [secRes, itemRes] = await Promise.all([
        supabase.from('qa_checklist_sections').select('*').order('sort_order'),
        supabase.from('qa_checklist_items').select('*').order('sort_order'),
      ]);
      if (secRes.error) throw secRes.error;
      if (itemRes.error) throw itemRes.error;

      const itemsBySection = {};
      (itemRes.data || []).forEach(item => {
        if (!itemsBySection[item.section_id]) itemsBySection[item.section_id] = [];
        itemsBySection[item.section_id].push(item);
      });

      const merged = (secRes.data || []).map(sec => ({
        ...sec,
        items: itemsBySection[sec.id] || [],
      }));
      setSections(merged);
    } catch (err) {
      console.error('Failed to load QA checklist:', err);
      setDataError(err.message || 'Failed to load checklist data');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { loadChecklist(); }, [loadChecklist]);

  // Restore scroll position after sections update from a CRUD operation
  useEffect(() => {
    if (scrollRestoreRef.current !== null) {
      const y = scrollRestoreRef.current;
      scrollRestoreRef.current = null;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }, [sections]);

  const totalItems = useMemo(() => sections.reduce((s, sec) => s + sec.items.length, 0), [sections]);

  // ── Test run state ──────────────────────────────────────────────
  const [checked, setChecked] = useState(() => loadJSON(CURRENT_KEY, {}));
  const [collapsed, setCollapsed] = useState({});
  const [history, setHistory] = useState(() => loadJSON(HISTORY_KEY, []));
  const [notesHtml, setNotesHtml] = useState(() => localStorage.getItem(NOTES_KEY) || '');
  const [view, setView] = useState('current');   // 'current' | 'history' | 'detail' | 'manage'
  const [viewingRun, setViewingRun] = useState(null);

  useEffect(() => { localStorage.setItem(CURRENT_KEY, JSON.stringify(checked)); }, [checked]);
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem(NOTES_KEY, notesHtml); }, [notesHtml]);

  const checkedCount = useMemo(() => countChecked(checked), [checked]);
  const pct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  const toggle = useCallback((id) => setChecked(prev => ({ ...prev, [id]: !prev[id] })), []);
  const toggleSection = useCallback((id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] })), []);

  const sectionStats = useCallback((section, map) => {
    const done = section.items.filter(i => (map || checked)[i.id]).length;
    return { done, total: section.items.length };
  }, [checked]);

  const saveRun = () => {
    if (checkedCount === 0) return;
    const run = {
      id: Date.now(),
      tester: testerName,
      date: new Date().toISOString(),
      checked: { ...checked },
      checkedCount,
      totalItems,
      notes: notesHtml.trim() || null,
    };
    setHistory(prev => [run, ...prev]);
    setChecked({});
    setNotesHtml('');
  };

  const deleteRun = (runId) => {
    if (!window.confirm('Delete this test run? This cannot be undone.')) return;
    setHistory(prev => prev.filter(r => r.id !== runId));
    if (viewingRun?.id === runId) { setViewingRun(null); setView('history'); }
  };

  const resetCurrent = () => {
    if (!window.confirm('Clear all checkmarks on the current run?')) return;
    setChecked({});
  };

  const openDetail = (run) => { setViewingRun(run); setView('detail'); };

  // ── Admin CRUD state ────────────────────────────────────────────
  const [editingSection, setEditingSection] = useState(null);   // { id?, title, sort_order }
  const [editingItem, setEditingItem] = useState(null);         // { id?, section_id, label, action, expect, sort_order }
  const [saving, setSaving] = useState(false);
  const [dragState, setDragState] = useState({ type: null, id: null, sectionId: null, overId: null });

  // Renumber all sections sequentially in the DB
  const renumberSections = async () => {
    const { data, error } = await supabase
      .from('qa_checklist_sections')
      .select('id')
      .order('sort_order');
    if (error || !data) return;
    await Promise.all(data.map((s, i) =>
      supabase.from('qa_checklist_sections').update({ sort_order: i + 1 }).eq('id', s.id)
    ));
  };

  // Section CRUD
  const handleSaveSection = async () => {
    if (!editingSection?.title?.trim()) return;
    setSaving(true);
    try {
      if (editingSection.id) {
        const { error } = await supabase.from('qa_checklist_sections')
          .update({ title: editingSection.title.trim(), sort_order: editingSection.sort_order })
          .eq('id', editingSection.id);
        if (error) throw error;
      } else {
        const maxOrder = sections.reduce((m, s) => Math.max(m, s.sort_order), 0);
        const { error } = await supabase.from('qa_checklist_sections')
          .insert({ title: editingSection.title.trim(), sort_order: maxOrder + 1 });
        if (error) throw error;
      }
      setEditingSection(null);
      await renumberSections();
      scrollRestoreRef.current = window.scrollY;
      await loadChecklist();
    } catch (err) {
      alert('Error saving section: ' + err.message);
    } finally { setSaving(false); }
  };

  const handleDeleteSection = async (secId) => {
    if (!window.confirm('Delete this section and ALL its test items? This cannot be undone.')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('qa_checklist_sections').delete().eq('id', secId);
      if (error) throw error;
      await renumberSections();
      scrollRestoreRef.current = window.scrollY;
      await loadChecklist();
    } catch (err) {
      alert('Error deleting section: ' + err.message);
    } finally { setSaving(false); }
  };

  // Item CRUD
  const handleSaveItem = async () => {
    if (!editingItem?.label?.trim()) return;
    setSaving(true);
    try {
      if (editingItem.id) {
        const { error } = await supabase.from('qa_checklist_items')
          .update({
            label: editingItem.label.trim(),
            action: editingItem.action.trim(),
            expect: editingItem.expect.trim(),
            sort_order: editingItem.sort_order,
          })
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const sec = sections.find(s => s.id === editingItem.section_id);
        const maxOrder = sec ? sec.items.reduce((m, i) => Math.max(m, i.sort_order), 0) : 0;
        const { error } = await supabase.from('qa_checklist_items')
          .insert({
            section_id: editingItem.section_id,
            label: editingItem.label.trim(),
            action: editingItem.action.trim(),
            expect: editingItem.expect.trim(),
            sort_order: maxOrder + 1,
          });
        if (error) throw error;
      }
      setEditingItem(null);
      scrollRestoreRef.current = window.scrollY;
      await loadChecklist();
    } catch (err) {
      alert('Error saving item: ' + err.message);
    } finally { setSaving(false); }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this test item?')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('qa_checklist_items').delete().eq('id', itemId);
      if (error) throw error;
      scrollRestoreRef.current = window.scrollY;
      await loadChecklist();
    } catch (err) {
      alert('Error deleting item: ' + err.message);
    } finally { setSaving(false); }
  };

  // ── Drag-and-drop reordering ─────────────────────────────────
  const resetDrag = () => setDragState({ type: null, id: null, sectionId: null, overId: null });

  const handleDragStart = (type, id, sectionId = null) => (e) => {
    setDragState({ type, id, sectionId, overId: null });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };

  const handleDragOver = (type, id, sectionId = null) => (e) => {
    e.preventDefault();
    if (dragState.type === type && dragState.id !== id) {
      if (type === 'item' && dragState.sectionId !== sectionId) return;
      setDragState(prev => ({ ...prev, overId: id }));
    }
  };

  const handleDragEnd = () => resetDrag();

  const handleSectionDrop = async (targetId) => {
    if (dragState.type !== 'section' || !dragState.id || dragState.id === targetId) {
      resetDrag(); return;
    }
    const ordered = [...sections];
    const fromIdx = ordered.findIndex(s => s.id === dragState.id);
    const toIdx = ordered.findIndex(s => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { resetDrag(); return; }
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    setSections(ordered.map((s, i) => ({ ...s, sort_order: i + 1 })));
    resetDrag();
    try {
      await Promise.all(ordered.map((s, i) =>
        supabase.from('qa_checklist_sections').update({ sort_order: i + 1 }).eq('id', s.id)
      ));
    } catch (err) {
      console.error('Reorder sections failed:', err);
      scrollRestoreRef.current = window.scrollY;
      await loadChecklist();
    }
  };

  const handleItemDrop = async (sectionId, targetItemId) => {
    if (dragState.type !== 'item' || !dragState.id || dragState.id === targetItemId) {
      resetDrag(); return;
    }
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) { resetDrag(); return; }
    const items = [...sec.items];
    const fromIdx = items.findIndex(i => i.id === dragState.id);
    const toIdx = items.findIndex(i => i.id === targetItemId);
    if (fromIdx === -1 || toIdx === -1) { resetDrag(); return; }
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, items: items.map((it, i) => ({ ...it, sort_order: i + 1 })) }
        : s
    ));
    resetDrag();
    try {
      await Promise.all(items.map((it, i) =>
        supabase.from('qa_checklist_items').update({ sort_order: i + 1 }).eq('id', it.id)
      ));
    } catch (err) {
      console.error('Reorder items failed:', err);
      scrollRestoreRef.current = window.scrollY;
      await loadChecklist();
    }
  };

  // ── Shared sub-components ───────────────────────────────────────
  const ProgressBar = ({ count, total }) => {
    const p = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div style={st.progressTrack}>
        <div style={{ ...st.progressFill, width: p + '%', background: p === 100 ? '#16a34a' : '#4f46e5' }} />
      </div>
    );
  };

  // ── Checklist renderer ──────────────────────────────────────────
  const renderChecklist = (checkedMap, readOnly = false) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {sections.map(section => {
        const { done, total } = sectionStats(section, checkedMap);
        const isCollapsed = collapsed[section.id];
        const allDone = done === total;
        return (
          <div key={section.id}>
            <button onClick={() => toggleSection(section.id)} style={st.sectionRow}>
              {isCollapsed ? <ChevronRight size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
              <span style={st.sectionLabel}>{section.title}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: allDone ? '#16a34a' : '#94a3b8', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {done}/{total}
              </span>
            </button>
            {!isCollapsed && section.items.map((item, idx) => {
              const isDone = !!checkedMap[item.id];
              return (
                <div key={item.id} style={{ ...st.itemRow, background: isDone ? '#f0fdf4' : idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <button
                    onClick={readOnly ? undefined : () => toggle(item.id)}
                    style={{ ...st.checkBox, cursor: readOnly ? 'default' : 'pointer' }}
                    disabled={readOnly}
                  >
                    {isDone
                      ? <div style={st.checkBoxChecked}><Check size={10} color="#fff" strokeWidth={3} /></div>
                      : <div style={st.checkBoxEmpty} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: isDone ? '#6b7280' : '#1e293b', textDecoration: isDone ? 'line-through' : 'none' }}>
                      {item.label}
                    </div>
                    <div style={st.meta}><span style={st.metaKey}>Do:</span> {item.action}</div>
                    <div style={st.meta}><span style={st.metaKey}>Expect:</span> {item.expect}</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  // ── Loading / error states ────────────────────────────────────
  if (dataLoading) {
    return (
      <div style={{ ...st.pageWide, textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 14, color: '#94a3b8' }}>Loading checklist...</div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div style={{ ...st.pageWide, textAlign: 'center', padding: '80px 20px' }}>
        <AlertCircle size={24} color="#ef4444" style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 14, color: '#ef4444', marginBottom: 12 }}>{dataError}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          Make sure you've run the <code>create_qa_checklist_tables.sql</code> migration in your Supabase SQL editor.
        </div>
        <button onClick={loadChecklist} style={{ ...st.histBtn, marginTop: 16 }}>Retry</button>
      </div>
    );
  }

  // ── MANAGE VIEW (admin only) ──────────────────────────────────
  if (view === 'manage' && isAdmin) {
    return (
      <div style={st.pageWide}>
        <button onClick={() => setView('current')} style={{ ...st.backLink, color: '#fff' }}>
          <ArrowLeft size={14} /> Back to Checklist
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
            Manage Test Sections & Items
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setEditingSection({ id: null, title: '', sort_order: 0 })}
              style={st.addBtn}
            >
              <Plus size={14} /> Add Section
            </button>
            <button onClick={loadChecklist} disabled={saving} style={st.saveBtn}>
              <Save size={13} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Section editor modal */}
        {editingSection && (
          <div style={st.modalBackdrop} onClick={() => setEditingSection(null)}>
            <div style={st.modalContent} onClick={e => e.stopPropagation()}>
              <div style={st.modalHeader}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>
                  {editingSection.id ? 'Edit Section' : 'New Section'}
                </span>
                <button onClick={() => setEditingSection(null)} style={st.modalClose}><X size={16} /></button>
              </div>
              <div style={st.modalBody}>
                <label style={st.fieldLabel}>Title</label>
                <input
                  value={editingSection.title}
                  onChange={e => setEditingSection(p => ({ ...p, title: e.target.value }))}
                  placeholder='e.g. "20 · New Feature Area"'
                  style={st.input}
                  autoFocus
                />
                <label style={st.fieldLabel}>Sort Order</label>
                <input
                  type="number"
                  value={editingSection.sort_order}
                  onChange={e => setEditingSection(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                  style={{ ...st.input, width: 80 }}
                />
              </div>
              <div style={st.modalFooter}>
                <button onClick={handleSaveSection} disabled={saving} style={st.saveBtn}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditingSection(null)} style={st.cancelBtn}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Item editor modal */}
        {editingItem && (
          <div style={st.modalBackdrop} onClick={() => setEditingItem(null)}>
            <div style={st.modalContent} onClick={e => e.stopPropagation()}>
              <div style={st.modalHeader}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>
                  {editingItem.id ? 'Edit Item' : 'New Item'}
                </span>
                <button onClick={() => setEditingItem(null)} style={st.modalClose}><X size={16} /></button>
              </div>
              <div style={st.modalBody}>
                <label style={st.fieldLabel}>Label</label>
                <input
                  value={editingItem.label}
                  onChange={e => setEditingItem(p => ({ ...p, label: e.target.value }))}
                  placeholder="Test case name"
                  style={st.input}
                  autoFocus
                />
                <label style={st.fieldLabel}>Action (Do)</label>
                <textarea
                  value={editingItem.action}
                  onChange={e => setEditingItem(p => ({ ...p, action: e.target.value }))}
                  placeholder="Steps the tester should perform"
                  style={{ ...st.input, minHeight: 60 }}
                />
                <label style={st.fieldLabel}>Expected Result</label>
                <textarea
                  value={editingItem.expect}
                  onChange={e => setEditingItem(p => ({ ...p, expect: e.target.value }))}
                  placeholder="What should happen"
                  style={{ ...st.input, minHeight: 60 }}
                />
                <label style={st.fieldLabel}>Sort Order</label>
                <input
                  type="number"
                  value={editingItem.sort_order}
                  onChange={e => setEditingItem(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                  style={{ ...st.input, width: 80 }}
                />
              </div>
              <div style={st.modalFooter}>
                <button onClick={handleSaveItem} disabled={saving} style={st.saveBtn}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditingItem(null)} style={st.cancelBtn}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Sections list */}
        {sections.map(sec => (
          <div
            key={sec.id}
            style={st.manageSectionBlock}
            onDragOver={handleDragOver('section', sec.id)}
            onDrop={(e) => { e.preventDefault(); handleSectionDrop(sec.id); }}
          >
            <div
              style={{
                ...st.manageSectionHeader,
                ...(dragState.overId === sec.id && dragState.type === 'section' ? { borderTop: '2px solid #4f46e5' } : {}),
              }}
              draggable
              onDragStart={handleDragStart('section', sec.id)}
              onDragEnd={handleDragEnd}
            >
              <GripVertical size={14} color="#cbd5e1" style={{ cursor: 'grab', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: '#334155', fontSize: 14, flex: 1 }}>
                {sec.title}
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 8 }}>
                #{sec.sort_order} · {sec.items.length} item{sec.items.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setEditingSection({ id: sec.id, title: sec.title, sort_order: sec.sort_order })}
                style={{ ...st.iconBtn, color: '#64748b' }}
                title="Edit section"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => handleDeleteSection(sec.id)}
                style={{ ...st.iconBtn, color: '#ef4444' }}
                title="Delete section"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={() => setEditingItem({ id: null, section_id: sec.id, label: '', action: '', expect: '', sort_order: 0 })}
                style={{ ...st.iconBtn, color: '#16a34a' }}
                title="Add item to this section"
              >
                <Plus size={13} />
              </button>
            </div>
            {sec.items.map(item => (
              <div
                key={item.id}
                style={{
                  ...st.manageItemRow,
                  ...(dragState.overId === item.id && dragState.type === 'item' ? { borderTop: '2px solid #4f46e5' } : {}),
                }}
                draggable
                onDragStart={handleDragStart('item', item.id, sec.id)}
                onDragOver={handleDragOver('item', item.id, sec.id)}
                onDrop={(e) => { e.preventDefault(); handleItemDrop(sec.id, item.id); }}
                onDragEnd={handleDragEnd}
              >
                <GripVertical size={12} color="#cbd5e1" style={{ cursor: 'grab', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Do: {item.action}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Expect: {item.expect}</div>
                </div>
                <button
                  onClick={() => setEditingItem({
                    id: item.id,
                    section_id: sec.id,
                    label: item.label,
                    action: item.action,
                    expect: item.expect,
                    sort_order: item.sort_order,
                  })}
                  style={{ ...st.iconBtn, color: '#64748b' }}
                  title="Edit item"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  style={{ ...st.iconBtn, color: '#ef4444' }}
                  title="Delete item"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {sec.items.length === 0 && (
              <div style={{ padding: '12px 14px 12px 36px', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                No items yet
              </div>
            )}
          </div>
        ))}

        {sections.length === 0 && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
            No sections yet. Click &ldquo;Add Section&rdquo; to get started.
          </div>
        )}
      </div>
    );
  }

  // ── Detail view ───────────────────────────────────────────────
  if (view === 'detail' && viewingRun) {
    const r = viewingRun;
    const rPct = r.totalItems > 0 ? Math.round((r.checkedCount / r.totalItems) * 100) : 0;
    return (
      <div style={st.pageWide}>
        <button onClick={() => { setViewingRun(null); setView('history'); }} style={st.backLink}>
          <ArrowLeft size={14} /> Back to History
        </button>
        <div style={st.detailHead}>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Test Run</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{fmtDate(r.date)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Tester</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{r.tester}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
            {r.checkedCount}/{r.totalItems} ({rPct}%)
          </span>
          <ProgressBar count={r.checkedCount} total={r.totalItems} />
        </div>
        {r.notes && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Notes</div>
            <div style={st.savedNotesBlock} dangerouslySetInnerHTML={{ __html: r.notes }} />
          </div>
        )}
        {renderChecklist(r.checked, true)}
      </div>
    );
  }

  // ── History view ──────────────────────────────────────────────
  if (view === 'history') {
    return (
      <div style={st.pageWide}>
        <button onClick={() => setView('current')} style={st.backLink}>
          <ArrowLeft size={14} /> Current Run
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
            <History size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
            Test Run History
          </h2>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>{history.length} run{history.length !== 1 ? 's' : ''}</span>
        </div>
        {history.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
            No saved test runs yet. Complete a run and click &ldquo;Save Run&rdquo; to archive it.
          </div>
        ) : (
          <table style={st.table}>
            <thead>
              <tr>
                <th style={st.th}>Date</th>
                <th style={st.th}>Tester</th>
                <th style={st.th}>Progress</th>
                <th style={st.th}>Notes</th>
                <th style={{ ...st.th, width: 80, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(r => {
                const rPct = r.totalItems > 0 ? Math.round((r.checkedCount / r.totalItems) * 100) : 0;
                const plainNotes = r.notes ? r.notes.replace(/<[^>]+>/g, '').trim() : '';
                return (
                  <tr key={r.id} style={st.trow}>
                    <td style={st.td}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{fmtDate(r.date)}</div>
                    </td>
                    <td style={{ ...st.td, fontWeight: 500 }}>{r.tester}</td>
                    <td style={st.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: rPct === 100 ? '#16a34a' : '#475569', fontVariantNumeric: 'tabular-nums', minWidth: 60 }}>
                          {r.checkedCount}/{r.totalItems}
                        </span>
                        <div style={{ ...st.progressTrack, flex: 1, minWidth: 60 }}>
                          <div style={{ ...st.progressFill, width: rPct + '%', background: rPct === 100 ? '#16a34a' : '#4f46e5' }} />
                        </div>
                      </div>
                    </td>
                    <td style={st.td}>
                      {plainNotes ? (
                        <div style={{ fontSize: 12, color: '#64748b', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {plainNotes.slice(0, 80)}{plainNotes.length > 80 ? '\u2026' : ''}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#cbd5e1' }}>{'\u2014'}</span>
                      )}
                    </td>
                    <td style={{ ...st.td, textAlign: 'center' }}>
                      <button onClick={() => openDetail(r)} style={st.iconBtn} title="View"><Eye size={14} /></button>
                      <button onClick={() => deleteRun(r.id)} style={{ ...st.iconBtn, color: '#ef4444' }} title="Delete"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // ── Current run (default) — TWO PANEL ─────────────────────────
  return (
    <div style={st.pageWide}>
      {/* Header */}
      <div style={st.titleRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={20} color="#4f46e5" />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Manual Verification Checklist</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Tester: <span style={{ color: '#475569', fontWeight: 500 }}>{testerName}</span>
          </div>
          {isAdmin && (
            <button onClick={() => setView('manage')} style={st.manageBtn}>
              <Pencil size={13} /> Manage Tests
            </button>
          )}
          <button onClick={() => setView('history')} style={st.histBtn}>
            <History size={14} /> History{history.length > 0 ? ` (${history.length})` : ''}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div style={st.statusBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
            {checkedCount}/{totalItems} ({pct}%)
          </span>
          <ProgressBar count={checkedCount} total={totalItems} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={resetCurrent} style={st.resetBtn} title="Clear all checkmarks">
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={saveRun}
            disabled={checkedCount === 0}
            style={{ ...st.saveBtn, opacity: checkedCount === 0 ? 0.4 : 1, cursor: checkedCount === 0 ? 'not-allowed' : 'pointer' }}
            title="Save this run to history"
          >
            <Save size={13} /> Save Run
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div style={st.twoPanelGrid}>
        {/* LEFT — Checklist */}
        <div style={st.panelLeft}>
          {sections.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              No test sections found.{isAdmin ? ' Click "Manage Tests" to add sections and items.' : ' An admin needs to set up the checklist.'}
            </div>
          ) : (
            renderChecklist(checked)
          )}
          <div style={st.footerTip}>
            If any step fails, capture the field name, template, lesson ID, and exact error text. For AI issues, capture the prompt preview and model used.
          </div>
        </div>

        {/* RIGHT — TipTap notes (sticky) */}
        <div style={st.panelRight}>
          <div style={st.notesPanel}>
            <div style={st.notesPanelHeader}>
              <FileText size={14} color="#4f46e5" />
              <span style={{ fontWeight: 700, color: '#334155', fontSize: 13 }}>Test Notes</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>auto-saved</span>
            </div>
            <TipTapEditor
              content={notesHtml}
              onChange={setNotesHtml}
              placeholder="Write notes, bugs, observations as you test..."
              minHeight="400px"
              fontSize="0.85rem"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const st = {
  pageWide: {
    maxWidth: 1320,
    margin: '0 auto',
    padding: '24px 20px 48px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 },
  histBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 500, color: '#475569', cursor: 'pointer' },
  manageBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #e2e8f0', background: '#fefce8', fontSize: 13, fontWeight: 500, color: '#92400e', cursor: 'pointer' },
  statusBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', marginBottom: 16 },
  resetBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 500, color: '#64748b', cursor: 'pointer' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', border: 'none', background: '#4f46e5', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' },

  // Two-panel grid
  twoPanelGrid: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' },
  panelLeft: { minWidth: 0 },
  panelRight: { position: 'sticky', top: 80, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' },
  notesPanel: { border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' },
  notesPanelHeader: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },

  // Progress
  progressTrack: { flex: 1, height: 4, background: '#e2e8f0', overflow: 'hidden' },
  progressFill: { height: '100%', transition: 'width 0.3s ease' },

  // Section + item rows
  sectionRow: { display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 14px', background: '#f1f5f9', border: 'none', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 13, textAlign: 'left' },
  sectionLabel: { fontWeight: 700, color: '#334155', letterSpacing: '-0.01em' },
  itemRow: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px 10px 36px', borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' },
  checkBox: { background: 'none', border: 'none', padding: 0, marginTop: 2, flexShrink: 0 },
  checkBoxEmpty: { width: 16, height: 16, border: '1.5px solid #cbd5e1', background: '#fff' },
  checkBoxChecked: { width: 16, height: 16, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  meta: { fontSize: 12, color: '#64748b', lineHeight: 1.5 },
  metaKey: { fontWeight: 600, color: '#475569' },

  // History table
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e2e8f0', background: '#fafafa' },
  trow: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 12px', fontSize: 13, color: '#475569', verticalAlign: 'middle' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748b' },

  // Navigation / detail
  backLink: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#4f46e5', padding: 0, marginBottom: 16 },
  detailHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', marginBottom: 8, borderBottom: '1px solid #e2e8f0' },
  savedNotesBlock: { padding: '12px 16px', background: '#fffbeb', borderLeft: '3px solid #f59e0b', fontSize: 13, color: '#78716c', lineHeight: 1.6 },
  footerTip: { marginTop: 24, padding: '10px 14px', background: '#fafafa', borderTop: '1px solid #e2e8f0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 },

  // Admin manage view
  addBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', border: 'none', background: '#16a34a', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' },
  cancelBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 500, color: '#64748b', cursor: 'pointer' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#fefce8' },
  modalBody: { padding: '12px 16px' },
  modalFooter: { display: 'flex', gap: 6, padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#fafafa' },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748b', display: 'flex', alignItems: 'center' },
  fieldLabel: { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 8, marginBottom: 4 },
  input: { display: 'block', width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, color: '#1e293b', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' },
  manageSectionBlock: { marginBottom: 2, border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden', background: '#fff' },
  manageSectionHeader: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' },
  manageItemRow: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 14px 8px 32px', borderBottom: '1px solid #f1f5f9', background: '#fff' },
};
