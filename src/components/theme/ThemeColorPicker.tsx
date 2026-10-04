'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, RotateCcw } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { PRESET_THEME_COLORS, DEFAULT_PRIMARY_COLOR, parseHex, getContrastTextColor } from '@/lib/colorUtils';
import styles from './ThemeColorPicker.module.css';

export function ThemeColorPicker() {
  const { primaryColor, setPrimaryColor, resetPrimaryColor, isMounted } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [customHex, setCustomHex] = useState(primaryColor);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync customHex with active primaryColor
  useEffect(() => {
    setCustomHex(primaryColor);
  }, [primaryColor]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isMounted) {
    return (
      <div className={styles.container}>
        <button
          type="button"
          className={styles.pickerBtn}
          aria-label="Change theme accent color"
          disabled
        >
          <span
            className={styles.colorSwatch}
            style={{ backgroundColor: DEFAULT_PRIMARY_COLOR }}
          />
          <span className={styles.btnText}>Color</span>
        </button>
      </div>
    );
  }

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith('#')) {
      val = '#' + val;
    }
    setCustomHex(val);

    if (parseHex(val)) {
      setPrimaryColor(val);
    }
  };

  const handleNativeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomHex(val);
    setPrimaryColor(val);
  };

  const handlePresetSelect = (hex: string) => {
    setCustomHex(hex);
    setPrimaryColor(hex);
  };

  const handleReset = () => {
    resetPrimaryColor();
    setCustomHex(DEFAULT_PRIMARY_COLOR);
    setIsOpen(false);
  };

  const isDefault = primaryColor.toLowerCase() === DEFAULT_PRIMARY_COLOR.toLowerCase();

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.pickerBtn}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Change theme accent color"
        aria-expanded={isOpen}
        title="Customize theme accent color"
      >
        <span
          className={styles.colorSwatch}
          style={{ backgroundColor: primaryColor }}
        />
        <Palette size={15} />
        <span className={styles.btnText}>Color</span>
      </button>

      {isOpen && (
        <div className={styles.popover} role="dialog" aria-label="Theme Accent Color Picker">
          <div className={styles.header}>
            <div className={styles.title}>
              <Palette size={16} />
              <span>Theme Accent Color</span>
            </div>
            <span className={styles.subtitle}>
              Customize buttons, highlights, badges & active states
            </span>
          </div>

          <div>
            <div className={styles.sectionLabel}>Presets</div>
            <div className={styles.presetsGrid}>
              {PRESET_THEME_COLORS.map((preset) => {
                const isSelected =
                  primaryColor.toLowerCase() === preset.hex.toLowerCase();
                const rgb = parseHex(preset.hex);
                const checkColor = rgb
                  ? getContrastTextColor(rgb.r, rgb.g, rgb.b)
                  : '#ffffff';

                return (
                  <button
                    key={preset.hex}
                    type="button"
                    className={`${styles.swatchBtn} ${
                      isSelected ? styles.activeSwatch : ''
                    }`}
                    style={{ backgroundColor: preset.hex }}
                    onClick={() => handlePresetSelect(preset.hex)}
                    title={preset.name}
                    aria-label={`Select ${preset.name}`}
                  >
                    {isSelected && (
                      <Check
                        size={14}
                        color={checkColor}
                        className={styles.checkIcon}
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.customSection}>
            <div className={styles.sectionLabel}>Custom Hex / Picker</div>
            <div className={styles.customRow}>
              <label className={styles.colorPickerTrigger} title="Open color palette wheel">
                <input
                  type="color"
                  className={styles.nativeInput}
                  value={parseHex(customHex) ? customHex : primaryColor}
                  onChange={handleNativeColorChange}
                  aria-label="Custom color picker wheel"
                />
                <div
                  className={styles.colorPreviewBox}
                  style={{ backgroundColor: primaryColor }}
                />
              </label>

              <input
                type="text"
                className={styles.hexInput}
                value={customHex}
                onChange={handleHexChange}
                placeholder="#2563eb"
                maxLength={7}
                aria-label="Hex color value"
              />
            </div>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.resetBtn}
              onClick={handleReset}
              disabled={isDefault}
              title="Reset to default royal blue"
            >
              <RotateCcw size={12} />
              <span>Reset Default</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
