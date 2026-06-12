import { ConnectButton } from '@rainbow-me/rainbowkit';
import AudioPlayer from './AudioPlayer.jsx';

const shortAddr = a => a.slice(0, 6) + '…' + a.slice(-4);

export default function Nav() {
  return (
    <nav>
      <span className="brand">normituary</span>
      <span className="links">
        <a href="#field">the departed</a>
        <a href="#memorial">remembrance</a>
        <a href="https://normies.art" target="_blank" rel="noreferrer">normies.art &#8599;</a>
        <AudioPlayer />
        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
            const ready = mounted;
            const connected = ready && account && chain;
            return (
              <button
                type="button"
                className={`wallet-btn${connected ? ' connected' : ''}`}
                onClick={connected ? openAccountModal : openConnectModal}
                title={connected ? account.address : ''}
                style={!ready ? { opacity: 0, pointerEvents: 'none' } : undefined}
              >
                {connected ? shortAddr(account.address) : 'connect wallet'}
              </button>
            );
          }}
        </ConnectButton.Custom>
      </span>
    </nav>
  );
}
