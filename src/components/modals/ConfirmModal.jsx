import React from 'react';
import { APP_CONFIG } from '../../config';

export default function ConfirmModal({ 
  title = 'Confirm', 
  message, 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm, 
  onCancel,
  dangerous = false
}) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: `blur(${APP_CONFIG.modals.backdropBlur})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--gray-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: dangerous ? '#dc2626' : 'var(--gray-900)',
            margin: 0
          }}>
            {title}
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          <p style={{
            color: 'var(--gray-600)',
            fontSize: '1rem',
            marginBottom: '1.5rem',
            lineHeight: '1.5'
          }}>
            {message}
          </p>
          
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid var(--gray-300)',
                borderRadius: '8px',
                backgroundColor: '#fff',
                color: 'var(--gray-700)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-50)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#fff';
              }}
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: dangerous ? '#dc2626' : 'var(--primary)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = dangerous ? '#b91c1c' : '#2563eb';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = dangerous ? '#dc2626' : 'var(--primary)';
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
