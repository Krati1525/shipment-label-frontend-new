'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Sparkles, Key, CheckCircle2, ShieldAlert } from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey, isGeminiVisionConfigured } from '@/lib/extraction/gemini-service';

export interface GeminiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function GeminiSettingsModal({ isOpen, onClose, onSaved }: GeminiSettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getGeminiApiKey() || '';
      setApiKey(current);
      setIsConfigured(Boolean(current));
      setSavedSuccess(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    setGeminiApiKey(apiKey.trim());
    setIsConfigured(Boolean(apiKey.trim()));
    setSavedSuccess(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handleClear = () => {
    setGeminiApiKey('');
    setApiKey('');
    setIsConfigured(false);
    setSavedSuccess(true);
    if (onSaved) onSaved();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vision OCR Engine Settings"
      size="md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          {isConfigured ? (
            <Button variant="danger" size="sm" onClick={handleClear}>
              Remove Key (Use Local Engine)
            </Button>
          ) : <div />}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} leftIcon={<Sparkles size={14} />}>
              Save Settings
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            backgroundColor: isConfigured ? '#ecfdf5' : '#f8fafc',
            border: `1px solid ${isConfigured ? '#a7f3d0' : '#e2e8f0'}`,
            color: isConfigured ? '#065f46' : '#334155',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {isConfigured ? (
            <>
              <CheckCircle2 size={18} color="#059669" />
              <span><strong>Google Gemini 1.5 Flash Vision is ACTIVE.</strong> Labels will be parsed with multimodal AI.</span>
            </>
          ) : (
            <>
              <ShieldAlert size={18} color="#64748b" />
              <span><strong>Local Free Vision Engine is ACTIVE.</strong> Using client-side Canvas auto-exposure, sharpening, and multi-angle OCR (100% free, zero external API required).</span>
            </>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
            Google Gemini API Key (Optional)
          </label>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            type="password"
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
            Enter a free Google AI Studio Gemini API key to activate multimodal zero-error extraction. If left blank, the app runs completely offline using the built-in free computer vision algorithms.
          </span>
        </div>

        {savedSuccess && (
          <div style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 500 }}>
            ✓ Vision engine settings updated successfully!
          </div>
        )}
      </div>
    </Modal>
  );
}
