import { useEffect, useState } from 'react';
import { fetchHealth, type HealthCheck } from './lib/api';
import './App.css';

function App() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealth()
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>🤖 AI-Native Agentic Platform</h1>
        <p className="subtitle">Powered by Azure Cloud Infrastructure</p>
      </header>

      <main className="main">
        <section className="status-card">
          <h2>System Status</h2>
          {loading && <p className="loading">Checking system health...</p>}
          {error && <p className="error">❌ Error: {error}</p>}
          {health && (
            <div className="health-grid">
              <div className="health-item">
                <span className="label">API Status</span>
                <span className={`value ${health.status === 'ok' ? 'success' : 'error'}`}>
                  {health.status === 'ok' ? '✅ Online' : '❌ Offline'}
                </span>
              </div>
              <div className="health-item">
                <span className="label">Database</span>
                <span className={`value ${health.db === 'connected' ? 'success' : 'error'}`}>
                  {health.db === 'connected' ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
              <div className="health-item">
                <span className="label">Redis Cache</span>
                <span className={`value ${health.redis === 'PONG' ? 'success' : 'error'}`}>
                  {health.redis === 'PONG' ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="features">
          <h2>Platform Features</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <span className="icon">🧠</span>
              <h3>AI Orchestration</h3>
              <p>Multi-provider AI support (Claude, GPT, Gemini)</p>
            </div>
            <div className="feature-card">
              <span className="icon">🔐</span>
              <h3>Secure by Design</h3>
              <p>Azure Key Vault & Managed Identity</p>
            </div>
            <div className="feature-card">
              <span className="icon">📊</span>
              <h3>Vector Database</h3>
              <p>PostgreSQL with pgvector extension</p>
            </div>
            <div className="feature-card">
              <span className="icon">⚡</span>
              <h3>High Performance</h3>
              <p>Redis caching & auto-scaling</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>© 2026 AI-Native Agentic Platform | Deployed on Azure + Vercel</p>
      </footer>
    </div>
  );
}

export default App;
