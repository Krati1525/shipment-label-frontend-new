'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';
import { Menu, Search, ShieldCheck } from 'lucide-react';

export interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Dashboard',
    subtitle: 'Shipment overview and operational health',
  },
  '/upload': {
    title: 'Upload Labels',
    subtitle: 'Drag and drop labels for OCR text extraction',
  },
  '/processing': {
    title: 'Processing Pipeline',
    subtitle: 'Automated OCR recognition and structured field extraction',
  },
  '/issues': {
    title: 'Issues Review',
    subtitle: 'Verify and resolve incomplete shipment data',
  },
  '/shipments': {
    title: 'Shipments',
    subtitle: 'Search, filter, export and manage shipments',
  },
};

export function Header({ onToggleMobileMenu }: HeaderProps) {
  const pathname = usePathname();

  const currentMeta = PAGE_META[pathname] || {
    title: 'ShipmentFlow',
    subtitle: 'Shipment Label Extractor',
  };

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <button
          type="button"
          className={styles.menuToggle}
          onClick={onToggleMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
        <div className={styles.titleArea}>
          <h1 className={styles.pageTitle}>{currentMeta.title}</h1>
          <span className={styles.subtitle}>{currentMeta.subtitle}</span>
        </div>
      </div>

      <div className={styles.centerSection}>
        <div className={styles.searchBox}>
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Global search (AWB, mobile, name)..."
            readOnly
            title="Use the Shipments page search for active querying"
          />
        </div>
      </div>

      <div className={styles.rightSection}>
        <div className={styles.operatorBadge}>
          <ShieldCheck size={14} className={styles.operatorDot} />
          <span>Operator Console</span>
        </div>
      </div>
    </header>
  );
}
