// Arquivo: Router.tsx
import { Routes, Route } from 'react-router-dom';
import { PlansPage } from './pages/PlansPage';

export function Router() {
  return (
    <Routes>
      <Route path="/plans" element={<PlansPage />} />
    </Routes>
  );
}