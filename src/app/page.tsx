'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentShipments } from '@/components/dashboard/RecentShipments';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Truck,
  UploadCloud,
  RefreshCw,
} from 'lucide-react';
import { DashboardData } from '@/types/shipment';
import { getDashboardData } from '@/lib/shipments';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Request sequence ID to prevent race conditions on rapid refresh clicks
  const latestRequestIdRef = useRef<number>(0);

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    const requestId = ++latestRequestIdRef.current;
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const dashboardData = await getDashboardData();

      // Discard stale responses if a newer request was dispatched
      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      setData(dashboardData);
    } catch (err: unknown) {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load dashboard data. Please verify backend connectivity.';
      setError(msg);

      // On initial load failure, clear data to show ErrorState
      if (!isRefresh) {
        setData(null);
      }
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  // Fetch real dashboard data on mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const isBusy = isLoading || isRefreshing;

  return (
    <div className={styles.dashboard}>
      {/* Welcome Banner with Quick Actions */}
      <div className={styles.welcomeBanner}>
        <div className={styles.welcomeText}>
          <h2>Logistics Operations Overview</h2>
          <p>
            Monitor automated label ingestion, OCR recognition health, and fulfillment readiness.
          </p>
        </div>
        <div className={styles.bannerActions}>
          <Button
            variant="secondary"
            size="md"
            onClick={() => loadDashboardData(true)}
            disabled={isBusy}
            leftIcon={
              <RefreshCw
                size={16}
                className={isBusy ? styles.spinning : ''}
              />
            }
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Link href="/upload">
            <Button
              variant="primary"
              size="md"
              leftIcon={<UploadCloud size={16} />}
            >
              Upload Labels
            </Button>
          </Link>
          <Link href="/issues">
            <Button
              variant="outline"
              size="md"
              leftIcon={<AlertTriangle size={16} />}
            >
              Review Issues
            </Button>
          </Link>
        </div>
      </div>

      {/* Error State with Retry */}
      {error && !data ? (
        <ErrorState
          title="Unable to load dashboard data"
          message={error}
          onRetry={() => loadDashboardData(false)}
        />
      ) : (
        <>
          {/* 5 Real Metric Stat Cards */}
          <div className={styles.statsGrid}>
            <StatCard
              label="Total Shipments"
              value={data ? data.stats.total : 0}
              description="All shipment records"
              icon={<Package size={20} />}
              theme="total"
              isLoading={isLoading && !data}
              href="/shipments"
            />
            <StatCard
              label="Processing"
              value={data ? data.stats.processing : 0}
              description="OCR and extraction in progress"
              icon={<Clock size={20} />}
              theme="processing"
              isLoading={isLoading && !data}
              href="/shipments?status=PROCESSING"
            />
            <StatCard
              label="Issues"
              value={data ? data.stats.issue : 0}
              description="Shipments needing manual review"
              icon={<AlertTriangle size={20} />}
              theme="issue"
              isLoading={isLoading && !data}
              href="/issues"
            />
            <StatCard
              label="Ready"
              value={data ? data.stats.ready : 0}
              description="Ready for dispatch"
              icon={<CheckCircle2 size={20} />}
              theme="ready"
              isLoading={isLoading && !data}
              href="/shipments?status=READY"
            />
            <StatCard
              label="Shipped"
              value={data ? data.stats.shipped : 0}
              description="Successfully dispatched"
              icon={<Truck size={20} />}
              theme="shipped"
              isLoading={isLoading && !data}
              href="/shipments?status=SHIPPED"
            />
          </div>

          {/* Recent Shipments Section */}
          <RecentShipments
            shipments={data?.recentShipments || []}
            isLoading={isLoading && !data}
          />
        </>
      )}
    </div>
  );
}
