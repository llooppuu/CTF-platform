import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import ChallengesPage from "./pages/ChallengesPage";
import ScoreboardPage from "./pages/ScoreboardPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import { useApp } from "./context/AppContext";

function RequireAuth({ children }) {
  const { currentUser } = useApp();
  return currentUser ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { currentUser } = useApp();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!currentUser.isAdmin) return <Navigate to="/challenges" replace />;
  return children;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/challenges" element={<ChallengesPage />} />
        <Route path="/scoreboard" element={<ScoreboardPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
