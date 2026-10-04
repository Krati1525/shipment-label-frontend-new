import type { Metadata } from 'next';
import '@/styles/globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { ThemeProvider } from '@/components/theme';

export const metadata: Metadata = {
  title: 'ShipmentFlow | Shipment Label Extractor & Logistics Operations',
  description:
    'Automated OCR shipment label extraction, issue resolution, and delivery notification management.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('shipmentflow_theme');
                  var isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

                  var savedColor = localStorage.getItem('shipmentflow_primary_color');
                  if (savedColor && /^#[0-9a-fA-F]{6}$/.test(savedColor)) {
                    var r = parseInt(savedColor.slice(1, 3), 16);
                    var g = parseInt(savedColor.slice(3, 5), 16);
                    var b = parseInt(savedColor.slice(5, 7), 16);
                    var yiq = (r * 299 + g * 587 + b * 114) / 1000;
                    var contrast = yiq >= 150 ? '#0f172a' : '#ffffff';
                    var factor = isDark ? 1.15 : 0.85;
                    var clamp = function(v) { return Math.max(0, Math.min(255, Math.round(v))); };
                    var hr = clamp(r * factor);
                    var hg = clamp(g * factor);
                    var hb = clamp(b * factor);
                    var hover = '#' + ((1 << 24) + (hr << 16) + (hg << 8) + hb).toString(16).slice(1);
                    var s = document.documentElement.style;
                    s.setProperty('--primary', savedColor);
                    s.setProperty('--primary-hover', hover);
                    s.setProperty('--primary-light', 'rgba(' + r + ',' + g + ',' + b + ',' + (isDark ? '0.2' : '0.12') + ')');
                    s.setProperty('--primary-border', 'rgba(' + r + ',' + g + ',' + b + ',' + (isDark ? '0.38' : '0.28') + ')');
                    s.setProperty('--primary-contrast', contrast);
                    s.setProperty('--border-focus', savedColor);
                    s.setProperty('--primary-focus-ring', 'rgba(' + r + ',' + g + ',' + b + ',' + (isDark ? '0.25' : '0.16') + ')');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
