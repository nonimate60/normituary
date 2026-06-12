import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Portrait } from '../portraits.jsx';

export default function Tombstone({ token, onClick, selectable, selected, onRespect }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const cls = `cell${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}`;
  return (
    <div className={cls} onClick={onClick}>
      {selectable && <span className="tick">&#10003;</span>}
      <div className="frame">
        <span className="ribbon"></span>
        <Portrait tokenId={token.tokenId} />
      </div>
      <h3>#{String(token.tokenId).padStart(4, '0')}</h3>
      <div className="dates">&dagger; {token.died}</div>
      <div className="pix">{token.pixelCount} px &middot; commit {token.commitId}</div>
      {selectable && (
        <button
          className="respect-btn"
          onClick={e => {
            e.stopPropagation();
            if (!isConnected) { openConnectModal?.(); return; }
            onRespect();
          }}
        >
          pay respects
        </button>
      )}
    </div>
  );
}
