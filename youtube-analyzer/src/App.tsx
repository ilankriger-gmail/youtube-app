// ========== SECAO: COMPONENTE APP ==========

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts';
import { LoginPage } from './pages/LoginPage';
import { HomePage, YouTubePage, InstagramPage, TikTokPage, TikTokCreatorsPage, InstagramCreatorsPage } from './pages';

/**
 * Rotas protegidas - requer autenticacao
 */
function ProtectedRoutes() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/youtube" element={<YouTubePage />} />
      <Route path="/instagram" element={<InstagramPage />} />
      <Route path="/tiktok" element={<TikTokPage />} />
      <Route path="/tiktok-creators" element={<TikTokCreatorsPage />} />
      <Route path="/instagram-creators" element={<InstagramCreatorsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * Componente raiz da aplicacao
 * AuthProvider envolve tudo para controle de acesso
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProtectedRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
