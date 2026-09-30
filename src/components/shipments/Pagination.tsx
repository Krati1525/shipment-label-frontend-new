import React from 'react';
import styles from './Pagination.module.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pagination as PaginationType } from '@/types/shipment';

export interface PaginationProps {
  pagination: PaginationType;
  onPageChange: (page: number) => void;
}

export function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, limit, total, totalPages } = pagination;

  if (total === 0) return null;

  const startEntry = Math.min((page - 1) * limit + 1, total);
  const endEntry = Math.min(page * limit, total);

  // Generate visible pages array
  const pages: number[] = [];
  for (let i = 1; i <= Math.max(1, totalPages); i++) {
    pages.push(i);
  }

  return (
    <div className={styles.container}>
      <span className={styles.summary}>
        Showing <strong style={{ color: 'var(--text-primary)' }}>{startEntry}</strong> to{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{endEntry}</strong> of{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> shipments
      </span>

      <div className={styles.controls} aria-label="Pagination">
        <button
          type="button"
          className={styles.pageBtn}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={cn(styles.pageBtn, p === page && styles.active)}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          className={styles.pageBtn}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
