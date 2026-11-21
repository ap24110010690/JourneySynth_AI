import React, { useCallback, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { Layout } from './components/Layout';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { APIDocumentation } from './pages/APIDocumentation';
import { AuthPage } from './pages/AuthPage';
import { CustomerExplorer } from './pages/CustomerExplorer';
import { Dashboard } from './pages/Dashboard';
import { DatasetPreparation } from './pages/DatasetPreparation';
import { DataValidation } from './pages/DataValidation';
import { GenerationHistory } from './pages/GenerationHistory';
import { JourneyAnalytics } from './pages/JourneyAnalytics';
import { ModelTesting } from './pages/ModelTesting';
import { Settings } from './pages/Settings';
import { SyntheticGeneration } from './pages/SyntheticGeneration';
import { api } from './services/api';
import type { PageKey } from './types';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [activeDatasetName, setActiveDatasetName] = useState<string>('sample_journey_data.csv');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const syncHeaderStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      await api.getHealth();
      setBackendHealthy(true);
      const ov = await api.getOverviewMetrics();
      setActiveDatasetName(ov.active_dataset.name);
    } catch {
      setBackendHealthy(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    syncHeaderStatus();
  }, [syncHeaderStatus, refreshSignal]);

  const triggerRefresh = useCallback(() => {
    setRefreshSignal((s) => s + 1);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070D19] flex flex-col items-center justify-center text-slate-100">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center border border-blue-400/20 shadow-lg shadow-blue-500/20 mb-4 animate-pulse">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <div className="text-sm font-semibold text-slate-200">JourneySynth AI</div>
        <div className="text-xs text-slate-500 mt-1">Initializing secure session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <AuthPage notify={notify} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigate={setActivePage}
            notify={notify}
            refreshSignal={refreshSignal}
          />
        );
      case 'dataset':
        return (
          <DatasetPreparation
            notify={notify}
            onDatasetUpdated={triggerRefresh}
          />
        );
      case 'generation':
        return (
          <SyntheticGeneration
            notify={notify}
            onGenerated={triggerRefresh}
          />
        );
      case 'validation':
        return (
          <DataValidation
            notify={notify}
            onValidated={triggerRefresh}
          />
        );
      case 'analytics':
        return <JourneyAnalytics notify={notify} />;
      case 'explorer':
        return <CustomerExplorer notify={notify} />;
      case 'model-testing':
        return <ModelTesting notify={notify} />;
      case 'api-docs':
        return <APIDocumentation />;
      case 'history':
        return <GenerationHistory notify={notify} onNavigate={setActivePage} />;
      case 'settings':
        return <Settings notify={notify} onHealthChecked={setBackendHealthy} />;
      default:
        return null;
    }
  };

  return (
    <>
      <Layout
        activePage={activePage}
        onNavigate={setActivePage}
        backendHealthy={backendHealthy}
        activeDatasetName={activeDatasetName}
        onQuickGenerate={() => setActivePage('generation')}
      >
        {renderPage()}
      </Layout>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
