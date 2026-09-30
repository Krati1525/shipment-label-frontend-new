'use client';

import React, { useState, ReactNode } from 'react';
import styles from './AppShell.module.css';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar
        isOpenOnMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className={styles.mainWrapper}>
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
