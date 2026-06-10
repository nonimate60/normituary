import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';

import '@rainbow-me/rainbowkit/styles.css';
import './styles.css';

import { wagmiConfig } from './wagmi.js';
import App from './App.jsx';

const queryClient = new QueryClient();

const theme = lightTheme({
  accentColor: '#48494b',
  accentColorForeground: '#e3e5e4',
  borderRadius: 'none',
  fontStack: 'system',
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="compact">
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
