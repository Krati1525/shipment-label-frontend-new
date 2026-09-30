'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';
import {
  LayoutDashboard,
  UploadCloud,
  AlertTriangle,
  Package,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Upload Labels', href: '/upload', icon: UploadCloud },
  { label: 'Issues', href: '/issues', icon: AlertTriangle },
  { label: 'Shipments', href: '/shipments', icon: Package },
];

export interface SidebarProps {
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ isOpenOnMobile = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {isOpenOnMobile && (
        <div
          className={styles.mobileOverlay}
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(styles.sidebar, isOpenOnMobile && styles.mobileOpen)}
        aria-label="Main Navigation"
      >
        <div className={styles.brand}>
          <div className={styles.logoIcon}>
            <Layers size={18} />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>ShipmentFlow</span>
            <span className={styles.brandTagline}>Label Extractor</span>
          </div>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(styles.navItem, isActive && styles.active)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={18} className={styles.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <div className={styles.footerStatus}>
            <span className={styles.pulseDot} />
            <span>Backend Online</span>
          </div>
          <span className={styles.footerVersion}>Logistics Operations v1.0</span>
        </div>
      </aside>
    </>
  );
}
