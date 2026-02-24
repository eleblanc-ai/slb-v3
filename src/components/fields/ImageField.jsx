import { useState, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import BaseField from './BaseField';

export default function ImageField({ 
  field, 
  value, 
  onChange, 
  onEdit, 
  onDelete, 
  onAIConfig, 
  onGenerateAI, 
  isGenerating, 
  hasGenerated,
  isMissing,
  hideRequiredAsterisk,
  onUploadImage
}) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imageDescription, setImageDescription] = useState(value?.description || '');
  const [aiGeneratedUrl, setAiGeneratedUrl] = useState(value?.url || '');
  const [altText, setAltText] = useState(value?.altText || '');
  const [imageModel, setImageModel] = useState(value?.imageModel || '');
  const [altTextModel, setAltTextModel] = useState(value?.altTextModel || '');
  
  // Update local state when value prop changes
  useEffect(() => {
    console.log('🔄 ImageField value changed:', value);
    if (value) {
      console.log('📸 Setting image URL:', value.url);
      console.log('📝 Setting alt text:', value.altText);
      setAiGeneratedUrl(value.url || '');
      setImageDescription(value.description || '');
      setAltText(value.altText || '');
      setImageModel(value.imageModel || '');
      setAltTextModel(value.altTextModel || '');
    }
  }, [value]);

  const updateValue = (updates) => {
    const newValue = {
      description: imageDescription,
      url: aiGeneratedUrl,
      altText,
      imageModel,
      altTextModel,
      ...updates
    };
    onChange?.(newValue);
  };

  const handleDeleteImage = () => {
    setAiGeneratedUrl('');
    setImageDescription('');
    setAltText('');
    setImageModel('');
    setAltTextModel('');
    onChange?.({ description: '', url: '', altText: '', imageModel: '', altTextModel: '' });
  };

  const handleDownloadImage = async () => {
    try {
      const response = await fetch(aiGeneratedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download image. Please try again.');
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (JPEG/JPG only)
    if (!file.type.match(/^image\/jpe?g$/)) {
      toast.error('Please select a JPEG/JPG image file.');
      e.target.value = '';
      return;
    }

    if (!onUploadImage) {
      toast.error('Image upload is not available.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      // Check if there's an existing image URL to delete
      const existingUrl = aiGeneratedUrl || '';
      await onUploadImage(field, file, existingUrl);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <BaseField 
      field={field}
      onEdit={onEdit} 
      onDelete={onDelete}
      onAIConfig={onAIConfig}
      onGenerateAI={onGenerateAI}
      isGenerating={isGenerating}
      hasGenerated={hasGenerated}
      isMissing={isMissing}
      hideRequiredAsterisk={hideRequiredAsterisk}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.75rem 0' }}>
        {/* Image Description Input */}
        <div>
          <label style={{ 
            display: 'block',
            fontSize: '0.8125rem', 
            color: 'var(--gray-600)', 
            marginBottom: '0.5rem',
            fontWeight: 500
          }}>
            Image Description (optional)
          </label>
          <textarea
            placeholder="e.g., A vibrant classroom with students reading books, warm lighting, photorealistic style"
            value={imageDescription}
            onChange={(e) => {
              const desc = e.target.value;
              setImageDescription(desc);
              updateValue({ description: desc });
            }}
            rows={3}
            style={{ 
              width: '100%', 
              padding: '0.75rem',
              border: '1px solid var(--gray-300)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              lineHeight: '1.5'
            }}
          />
        </div>

        {/* Upload Image Button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,image/jpeg"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isGenerating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 0.875rem',
              border: '1px solid var(--gray-300)',
              borderRadius: '8px',
              backgroundColor: isUploading ? 'var(--gray-100)' : '#fff',
              color: isUploading ? 'var(--gray-400)' : 'var(--gray-700)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: isUploading || isGenerating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              if (!isUploading && !isGenerating) {
                e.currentTarget.style.backgroundColor = 'var(--gray-50)';
                e.currentTarget.style.borderColor = 'var(--gray-400)';
              }
            }}
            onMouseOut={(e) => {
              if (!isUploading && !isGenerating) {
                e.currentTarget.style.backgroundColor = '#fff';
                e.currentTarget.style.borderColor = 'var(--gray-300)';
              }
            }}
          >
            <Upload size={14} />
            {isUploading ? 'Uploading...' : 'Upload Image (JPEG)'}
          </button>
        </div>
        
        {/* Generated Image Display */}
        {aiGeneratedUrl && (
          <div style={{ 
            border: '1px solid var(--gray-200)', 
            borderRadius: '8px', 
            padding: '1rem',
            backgroundColor: 'var(--gray-50)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '0.75rem' 
            }}>
              <p style={{ 
                fontSize: '0.75rem', 
                color: 'var(--gray-600)', 
                margin: 0,
                fontWeight: 600
              }}>
                Generated Image
              </p>
              <button
                type="button"
                onClick={handleDeleteImage}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  color: '#dc2626',
                  background: 'white',
                  border: '1px solid #dc2626',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#dc2626';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#dc2626';
                }}
              >
                Delete Image
              </button>
            </div>
            
            <img 
              src={aiGeneratedUrl} 
              alt={altText || 'AI Generated'} 
              style={{ 
                width: '100%', 
                height: 'auto', 
                maxHeight: '400px', 
                objectFit: 'contain',
                border: '2px solid var(--gray-200)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }} 
            />
            
            <a
              href={aiGeneratedUrl.split('?')[0]}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                fontSize: '0.75rem',
                color: '#3b82f6',
                marginBottom: '0.75rem',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              View full-size image ↗
            </a>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem', 
              marginBottom: '0.75rem',
              padding: '0.75rem',
              backgroundColor: 'white',
              borderRadius: '6px',
              border: '1px solid var(--gray-200)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--gray-500)' }}>
                  <span style={{ fontWeight: 600 }}>Image model:</span> {imageModel || 'N/A'}
                </div>
                
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--gray-500)' }}>
                <span style={{ fontWeight: 600 }}>Alt text model:</span> {altTextModel || 'N/A'}
              </div>
            </div>
          </div>
        )}
        
        {/* Alt Text Input */}
        <div>
          <label style={{ 
            display: 'block',
            fontSize: '0.8125rem', 
            color: 'var(--gray-600)', 
            marginBottom: '0.5rem',
            fontWeight: 500
          }}>
            Alt Text (for accessibility)
          </label>
          <textarea
            placeholder="Will be generated automatically, or add your own"
            value={altText}
            onChange={(e) => {
              const newAltText = e.target.value;
              setAltText(newAltText);
              updateValue({ altText: newAltText });
            }}
            rows={2}
            style={{ 
              width: '100%', 
              padding: '0.75rem',
              border: '1px solid var(--gray-300)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              lineHeight: '1.5'
            }}
          />
        </div>
      </div>
    </BaseField>
  );
}
