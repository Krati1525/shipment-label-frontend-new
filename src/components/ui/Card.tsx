import React, { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  children: ReactNode;
}

export function Card({ hoverable = false, className, children, ...props }: CardProps) {
  return (
    <div className={cn(styles.card, hoverable && styles.hoverable, className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn(styles.header, className)}>
      {title || subtitle ? (
        <div className={styles.titleGroup}>
          {title && <div className={styles.title}>{title}</div>}
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
      ) : (
        children
      )}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export function CardBody({
  flush = false,
  className,
  children,
}: {
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(flush ? styles.bodyFlush : styles.body, className)}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(styles.footer, className)}>{children}</div>;
}
