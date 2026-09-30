import React, { useState } from 'react';
import styles from './ImagePreview.module.css';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, X, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ImagePreviewProps {
  src?: string | null;
  alt?: string;
  className?: string;
  maxHeight?: string;
}

export function ImagePreview({
  src,
  alt = 'Shipment label preview',
  className,
  maxHeight = '420px',
}: ImagePreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(src));
  const [isError, setIsError] = useState(false);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  const toggleFullscreen = () => setIsFullscreen((prev) => !prev);

  // If no source provided
  if (!src) {
    return (
      <div className={cn(styles.container, className)} style={{ height: maxHeight }}>
        <div className={styles.stateFallback}>
          <ImageOff size={32} aria-hidden="true" />
          <p>No shipment label image available</p>
        </div>
      </div>
    );
  }

  // Broken image fallback
  if (isError) {
    return (
      <div className={cn(styles.container, className)} style={{ height: maxHeight }}>
        <div className={styles.stateFallback}>
          <ImageOff size={32} aria-hidden="true" />
          <p>Failed to load shipment label image</p>
          <span style={{ fontSize: '0.75rem' }}>The image file might be missing or inaccessible.</span>
        </div>
      </div>
    );
  }

  const renderControls = (inFullscreen = false) => (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.toolButton}
        onClick={handleZoomOut}
        disabled={zoom <= 0.5}
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <ZoomOut size={14} />
      </button>
      <button
        type="button"
        className={styles.toolButton}
        onClick={handleResetZoom}
        title="Reset Zoom"
        aria-label="Reset Zoom"
      >
        <RotateCcw size={14} />
        <span>{Math.round(zoom * 100)}%</span>
      </button>
      <button
        type="button"
        className={styles.toolButton}
        onClick={handleZoomIn}
        disabled={zoom >= 3}
        title="Zoom In"
        aria-label="Zoom In"
      >
        <ZoomIn size={14} />
      </button>
      <button
        type="button"
        className={styles.toolButton}
        onClick={toggleFullscreen}
        title={inFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
        aria-label={inFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
      >
        {inFullscreen ? <X size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );

  return (
    <>
      <div className={cn(styles.container, className)}>
        <div className={styles.toolbar}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Label View
          </span>
          {renderControls(false)}
        </div>

        <div className={styles.viewport} style={{ height: maxHeight }}>
          {isLoading && (
            <div className={styles.stateFallback}>
              <div className={styles.loadingSpinner} />
              <p>Loading label image...</p>
            </div>
          )}

          <div
            className={styles.imageWrapper}
            style={{
              transform: `scale(${zoom})`,
              display: isLoading ? 'none' : 'flex',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className={styles.image}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setIsError(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* Fullscreen view modal */}
      {isFullscreen && (
        <div className={styles.fullscreenModal} role="dialog" aria-label="Label Fullscreen View">
          <div className={styles.fullscreenToolbar}>
            <span style={{ fontWeight: 600 }}>{alt}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {renderControls(true)}
              <button
                type="button"
                className={styles.toolButton}
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                onClick={() => setIsFullscreen(false)}
                aria-label="Close fullscreen view"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className={styles.fullscreenViewport}>
            <div
              className={styles.imageWrapper}
              style={{
                transform: `scale(${zoom})`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt} className={styles.image} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
