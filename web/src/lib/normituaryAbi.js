const deathVoucherComponents = [
  { name: 'normieId', type: 'uint256' },
  { name: 'burner', type: 'address' },
  { name: 'burnTimestamp', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];

export const normituaryAbi = [
  {
    type: 'function',
    name: 'mintAsMourner',
    stateMutability: 'payable',
    inputs: [
      { name: 'voucher', type: 'tuple', components: deathVoucherComponents },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'mintPublic',
    stateMutability: 'payable',
    inputs: [
      { name: 'voucher', type: 'tuple', components: deathVoucherComponents },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'mourningEnd',
    stateMutability: 'view',
    inputs: [{ name: 'burnTimestamp', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'inMourning',
    stateMutability: 'view',
    inputs: [{ name: 'burnTimestamp', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'launchTime',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'PRICE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
];
