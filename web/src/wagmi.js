import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia } from 'wagmi/chains';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
  || 'ced065f73b3009352e823f55c5592023';

export const wagmiConfig = getDefaultConfig({
  appName: 'normituary',
  projectId,
  chains: [mainnet, sepolia],
  ssr: false,
});
