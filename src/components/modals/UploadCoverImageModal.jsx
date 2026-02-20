import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import JSZip from 'jszip';
import { useToast } from '../../hooks/useToast';

export default function UploadCoverImageModal({ 
  contentId,
  coverImageUrl,
  onClose
}) {
  const toast = useToast();
  const s3BucketUrl = 'https://us-east-1.console.aws.amazon.com/s3/buckets/thinkcerca-prod?prefix=lessons%2F&region=us-east-1&tab=objects';

  const handleDownloadImage = async () => {
    if (!contentId) {
      toast.warning('Content ID is required to download the cover image');
      return;
    }

    if (!coverImageUrl) {
      toast.warning('No cover image found. Please generate or upload a cover image first.');
      return;
    }

    try {
      // Fetch the image as a blob
      const response = await fetch(coverImageUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch cover image');
      }
      const imageBlob = await response.blob();

      // Create a zip file
      const zip = new JSZip();
      
      // Create a folder with the content ID and add the image
      const folder = zip.folder(contentId);
      folder.file('cover.jpg', imageBlob);

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create a download link and trigger it
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${contentId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error downloading cover image:', error);
      toast.error('Failed to download cover image. Please try again.');
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          animation: 'slideIn 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--gray-900)',
            margin: 0
          }}>
            Upload Cover Image to S3
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              color: 'var(--gray-500)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = 'var(--gray-700)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--gray-500)';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '1.5rem'
        }}>
          {/* Content ID Display */}
          {contentId && (
            <div style={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--gray-600)',
                marginBottom: '0.25rem'
              }}>
                Content ID
              </div>
              <div style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--gray-900)',
                fontFamily: 'monospace'
              }}>
                {contentId}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div style={{
            marginBottom: '1.5rem'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--gray-900)',
              marginBottom: '1rem',
              marginTop: 0
            }}>
              Instructions
            </h3>
            
            <ol style={{
              margin: 0,
              paddingLeft: '1.5rem',
              color: 'var(--gray-700)',
              lineHeight: 1.8
            }}>
              <li style={{ marginBottom: '0.75rem' }}>
                <strong>Download:</strong> Click the button below to download a zip file containing a folder named <code style={{
                  backgroundColor: '#f3f4f6',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace'
                }}>{contentId || '[content-id]'}</code> with the cover image as <code style={{
                  backgroundColor: '#f3f4f6',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace'
                }}>cover.jpg</code> inside
              </li>
              <li style={{ marginBottom: '0.75rem' }}>
                <strong>Extract:</strong> Unzip the downloaded file to extract the folder
              </li>
              <li style={{ marginBottom: '0.75rem' }}>
                <strong>Access S3 bucket:</strong> Click the link below to open the S3 bucket (requires AWS access)
              </li>
              <li>
                <strong>Upload:</strong> In the S3 bucket, click the <strong>Upload</strong> button in the top right, then click <strong>Add folder</strong> and select the extracted folder
              </li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {/* Download Button */}
            <button
              onClick={handleDownloadImage}
              disabled={!contentId || !coverImageUrl}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                backgroundColor: (contentId && coverImageUrl) ? '#10b981' : '#d1d5db',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: (contentId && coverImageUrl) ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                boxShadow: (contentId && coverImageUrl) ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (contentId && coverImageUrl) {
                  e.currentTarget.style.backgroundColor = '#059669';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (contentId && coverImageUrl) {
                  e.currentTarget.style.backgroundColor = '#10b981';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                }
              }}
            >
              <Download size={18} />
              Download Zip File
            </button>

            {/* S3 Bucket Link */}
            <a
              href={s3BucketUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                backgroundColor: '#fff',
                color: '#6366f1',
                border: '2px solid #6366f1',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#6366f1';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fff';
                e.currentTarget.style.color = '#6366f1';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              }}
            >
              <ExternalLink size={18} />
              Open S3 Bucket
            </a>
          </div>

          {/* Warning Note */}
          {(!contentId || !coverImageUrl) && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '8px',
              fontSize: '0.875rem',
              color: '#92400e'
            }}>
              <strong>Note:</strong> {!contentId ? 'Please set a Content ID for this lesson before uploading a cover image.' : 'Please generate or upload a cover image before downloading.'}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
