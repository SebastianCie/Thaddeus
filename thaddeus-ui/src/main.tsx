import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import keycloak from './auth/keycloak'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry up to 5 times with exponential backoff (covers Quarkus live-reload window ~1-3s)
      retry: 5,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
      staleTime: 30_000,
    },
  },
})

function mountApp() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

keycloak.init({ onLoad: 'login-required', pkceMethod: 'S256' }).then((authenticated) => {
  if (!authenticated) {
    keycloak.login();
    return;
  }

  (window as any).__kc_token = keycloak.token;

  keycloak.onTokenExpired = () => {
    keycloak.updateToken(30)
      .then(() => { (window as any).__kc_token = keycloak.token; })
      .catch(() => keycloak.logout());
  };

  mountApp();
}).catch(() => {
  console.error('Keycloak init failed');
});
