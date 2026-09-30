import React from 'react';
import styles from './UploadProgress.module.css';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProcessingStage {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

export interface UploadProgressProps {
  progress: number;
  stages: ProcessingStage[];
  statusMessage?: string;
  className?: string;
}

export function UploadProgress({
  progress,
  stages,
  statusMessage = 'Processing labels through OCR & extraction pipeline...',
  className,
}: UploadProgressProps) {
  return (
    <div className={cn(styles.container, className)} aria-live="polite">
      <div className={styles.header}>
        <span className={styles.title}>{statusMessage}</span>
        <span className={styles.percentage}>{Math.round(progress)}%</span>
      </div>

      <div className={styles.progressBarBg}>
        <div
          className={styles.progressBarFill}
          style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
        />
      </div>

      <div className={styles.stagesList}>
        {stages.map((stage) => {
          const isActive = stage.status === 'active';
          const isCompleted = stage.status === 'completed';

          return (
            <div
              key={stage.id}
              className={cn(
                styles.stageItem,
                isActive && styles.stageActive,
                isCompleted && styles.stageCompleted
              )}
            >
              <span className={styles.stageIcon}>
                {isCompleted ? (
                  <CheckCircle2 size={16} />
                ) : isActive ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Clock size={16} />
                )}
              </span>
              <span>{stage.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
