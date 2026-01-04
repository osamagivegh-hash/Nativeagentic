import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Chat } from './pages/Chat';
import { Insights } from './pages/Insights';
import { Audit } from './pages/Audit';
import { Agents } from './pages/Agents';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/agents" element={<Agents />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;






