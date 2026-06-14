import { useState } from 'react';
import { parseEther } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { normituaryAbi } from '../lib/normituaryAbi.js';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const NORMITUARY_ADDRESS = import.meta.env.VITE_NORMITUARY_ADDRESS;
const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 11155111);
const PUBLIC_PRICE = parseEther('0.02');

function voucherTuple(v) {
  return {
    normieId: BigInt(v.normieId),
    burner: v.burner,
    burnTimestamp: BigInt(v.burnTimestamp),
    deadline: BigInt(v.deadline),
  };
}

async function fetchVoucher(normieId, burnerAddress) {
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
  return res.json();
}

export function usePayRespects() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [txHash, setTxHash] = useState(undefined);
  const [phase, setPhase] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: CHAIN_ID });

  async function mintSingle({ voucher, signature, phase: vPhase }) {
    const fnName = vPhase === 'public' ? 'mintPublic' : 'mintAsMourner';
    const value = vPhase === 'public' ? PUBLIC_PRICE : 0n;
    const hash = await writeContractAsync({
      address: NORMITUARY_ADDRESS,
      abi: normituaryAbi,
      functionName: fnName,
      args: [voucherTuple(voucher), signature],
      value,
      chainId: CHAIN_ID,
    });
    setTxHash(hash);
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== 'success') {
      throw new Error(`transaction reverted (${hash})`);
    }
    return hash;
  }

  async function mintBatchMourner(vouchers) {
    const tuples = vouchers.map(v => voucherTuple(v.voucher));
    const sigs = vouchers.map(v => v.signature);
    const hash = await writeContractAsync({
      address: NORMITUARY_ADDRESS,
      abi: normituaryAbi,
      functionName: 'mintBatchAsMourner',
      args: [tuples, sigs],
      value: 0n,
      chainId: CHAIN_ID,
    });
    setTxHash(hash);
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== 'success') {
      throw new Error(`batch transaction reverted (${hash})`);
    }
    return hash;
  }

  async function payRespectsBatch({ normieIds, burnerAddress, onProgress }) {
    setError(null);
    setTxHash(undefined);
    setPhase(null);
    setIsSending(true);
    try {
      onProgress?.({ stage: 'fetching-vouchers', total: normieIds.length });

      const fetched = await Promise.allSettled(
        normieIds.map(id => fetchVoucher(id, burnerAddress)),
      );

      const valid = [];
      const results = [];
      fetched.forEach((vr, i) => {
        const id = Number(normieIds[i]);
        if (vr.status === 'fulfilled') {
          valid.push({ id, ...vr.value });
        } else {
          const msg = vr.reason?.shortMessage || vr.reason?.message || String(vr.reason);
          results.push({ tokenId: id, status: 'failed', error: msg });
        }
      });

      const mourning = valid.filter(v => v.phase !== 'public');
      const pub = valid.filter(v => v.phase === 'public');

      if (mourning.length >= 2) {
        onProgress?.({ stage: 'batch-tx', count: mourning.length });
        try {
          const hash = await mintBatchMourner(mourning);
          mourning.forEach(v => results.push({ tokenId: v.id, status: 'success', hash, phase: 'mourning' }));
        } catch (err) {
          const msg = err?.shortMessage || err?.message || String(err);
          mourning.forEach(v => results.push({ tokenId: v.id, status: 'failed', error: msg }));
        }
      } else if (mourning.length === 1) {
        const v = mourning[0];
        onProgress?.({ stage: 'single-tx', tokenId: v.id, phase: 'mourning' });
        try {
          const hash = await mintSingle(v);
          results.push({ tokenId: v.id, status: 'success', hash, phase: 'mourning' });
        } catch (err) {
          const msg = err?.shortMessage || err?.message || String(err);
          results.push({ tokenId: v.id, status: 'failed', error: msg });
        }
      }

      for (const v of pub) {
        onProgress?.({ stage: 'single-tx', tokenId: v.id, phase: 'public' });
        try {
          const hash = await mintSingle(v);
          results.push({ tokenId: v.id, status: 'success', hash, phase: 'public' });
        } catch (err) {
          const msg = err?.shortMessage || err?.message || String(err);
          results.push({ tokenId: v.id, status: 'failed', error: msg });
        }
      }

      onProgress?.({ stage: 'done', results });
      return { results, validCount: valid.length };
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsSending(false);
    }
  }

  return {
    payRespectsBatch,
    isLoading: isSending || receipt.isLoading,
    isSuccess: receipt.isSuccess,
    error,
    txHash,
    phase,
  };
}
