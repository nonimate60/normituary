import { useState } from 'react';
import { parseEther } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { normituaryAbi } from '../lib/normituaryAbi.js';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const NORMITUARY_ADDRESS = import.meta.env.VITE_NORMITUARY_ADDRESS;
const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 11155111);
const PUBLIC_PRICE = parseEther('0.02');

export function usePayRespects() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [txHash, setTxHash] = useState(undefined);
  const [phase, setPhase] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: CHAIN_ID });

  async function payRespects({ normieId, burnerAddress }) {
    setError(null);
    setTxHash(undefined);
    setPhase(null);
    setIsSending(true);
    try {
      const res = await fetch(`${BACKEND_URL}/voucher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ normieId, address: burnerAddress }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('still in mourning — only the original burner can mint right now');
        }
        const text = await res.text().catch(() => '');
        throw new Error(`voucher request failed (${res.status})${text ? `: ${text}` : ''}`);
      }
      const data = await res.json();
      const { voucher, signature, phase: phaseFromApi } = data;
      setPhase(phaseFromApi);

      const fnName = phaseFromApi === 'public' ? 'mintPublic' : 'mintAsMourner';
      const value = phaseFromApi === 'public' ? PUBLIC_PRICE : 0n;

      const voucherTuple = {
        normieId: BigInt(voucher.normieId),
        burner: voucher.burner,
        burnTimestamp: BigInt(voucher.burnTimestamp),
        deadline: BigInt(voucher.deadline),
      };

      const hash = await writeContractAsync({
        address: NORMITUARY_ADDRESS,
        abi: normituaryAbi,
        functionName: fnName,
        args: [voucherTuple, signature],
        value,
        chainId: CHAIN_ID,
      });
      setTxHash(hash);

      const r = await publicClient.waitForTransactionReceipt({ hash });
      if (r.status !== 'success') {
        throw new Error(`transaction reverted (${hash})`);
      }
      return { hash, phase: phaseFromApi };
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsSending(false);
    }
  }

  return {
    payRespects,
    isLoading: isSending || receipt.isLoading,
    isSuccess: receipt.isSuccess,
    error,
    txHash,
    phase,
  };
}
