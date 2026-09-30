import React, { ReactNode } from 'react';
import Link from 'next/link';
import styles from './StatCard.module.css';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon: ReactNode;
  theme?: 'total' | 'processing' | 'issue' | 'ready' | 'shipped';
  className?: string;
  isLoading?: boolean;
  href?: string;
}

export function StatCard({
  label,
  value,
  description,
  icon,
  theme = 'total',
  className,
  isLoading = false,
  href,
}: StatCardProps) {
  const cardElement = (
    <div className={cn(styles.card, className, href && styles.clickable)}>
      <div className={styles.content}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>
          {isLoading ? (
            <span className={styles.skeletonValue} aria-hidden="true" />
          ) : (
            value
          )}
        </span>
        {description && <span className={styles.description}>{description}</span>}
      </div>
      <div className={cn(styles.iconWrapper, styles[theme])} aria-hidden="true">
        {icon}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={styles.cardLink}>
        {cardElement}
      </Link>
    );
  }

  return cardElement;
}

