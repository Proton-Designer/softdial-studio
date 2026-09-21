import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PhoneNumbersProvider } from '@/contexts/PhoneNumbersContext';
import { AuthScreen } from './components/AuthScreen';
import { MainApp } from './components/MainApp';

function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1628]">
        <div className="text-[#B0BEC5]">Loading…</div>
      </div>
    );
  }

  return (
    <PhoneNumbersProvider>
      {!user ? (
        <AuthScreen
          mode={authMode}
          onToggleMode={() => setAuthMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
        />
      ) : (
        <MainApp />
      )}
    </PhoneNumbersProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
