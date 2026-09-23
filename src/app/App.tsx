const boundaries = ['Tauri desktop', 'React interface', 'Headless domain'] as const;

export function App() {
  return (
    <main className="shell">
      <section className="status-panel" aria-labelledby="system-title">
        <p className="eyebrow">VANTAGE SYSTEMS // OPERATIONS</p>
        <h1 id="system-title">ORPHEUS</h1>
        <p className="status-line">
          <span className="status-indicator" aria-hidden="true" />
          SYSTEM FOUNDATION READY
        </p>
        <p className="summary">
          Desktop shell initialized. Incident systems will connect through the isolated domain
          boundary.
        </p>
        <ul className="boundary-list" aria-label="Application boundaries">
          {boundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
