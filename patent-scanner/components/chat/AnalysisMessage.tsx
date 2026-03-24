import { ScanResult, RiskLevel } from '@/lib/types';

const riskColors: Record<RiskLevel, string> = {
  LOW: '#4ade80',
  MEDIUM: '#fbbf24',
  HIGH: '#f87171',
  CRITICAL: '#ef4444',
};

export function AnalysisMessage({ content }: { content: string }) {
  let result: ScanResult;
  try {
    result = JSON.parse(content);
  } catch {
    return null;
  }

  const rc = riskColors[result.riskLevel] || '#999';

  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--surface-active)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>IP</div>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Patent Analysis</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {result.dataSource === 'live' ? 'USPTO · Live Data' : 'USPTO · Training Knowledge'}
        </span>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '14px 16px' }}>
        {/* Risk header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{ background: rc, color: '#000', padding: '3px 10px', borderRadius: 2, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
            {result.riskLevel}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Risk Score: <strong style={{ color: 'var(--text-primary)' }}>{result.riskScore}/100</strong>
          </span>
        </div>

        {/* Summary */}
        <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)', marginBottom: 14 }}>
          {result.summary}
        </p>

        {/* Element risks */}
        {result.elementRisks?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Element Analysis</div>
            {result.elementRisks.map((er, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ color: riskColors[er.risk] || '#999', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 2, minWidth: 36 }}>{er.risk}</span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{er.element}</strong> — {er.reasoning}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Recommendations</div>
            {result.recommendations.map((r, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0', display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>→</span>
                {r}
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
          {result.disclaimer}
        </div>
      </div>
    </div>
  );
}
