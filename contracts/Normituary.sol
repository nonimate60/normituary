// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title Normituary — Remembrance
 * @notice Memorial NFTs for Normies burned via NormiesCanvas.
 *
 * Hybrid model:
 *  - MOURNING PERIOD (30 days per Normie): only the original burner
 *    may mint the memorial, for free (gas only) at any time.
 *  - AFTER MOURNING: open public mint at full price.
 *
 * Each Normie's mourning starts at max(burnTimestamp, launchTime),
 * ensuring pre-launch burners still receive their full 30-day window.
 *
 * The original burner may always mint for free, even after mourning ends.
 * Public mint opens after the 30-day mourning period.
 * First to call wins — the memorialized mapping prevents double-mint.
 *
 * Proof of death: EIP-712 voucher signed by the backend oracle, which
 * verifies the burn via NormiesAPI before signing:
 *   - normieId was actually burned (commitment revealed, not expired)
 *   - burner = owner of the burn commitment on NormiesCanvas
 *   - burnTimestamp = on-chain timestamp of the commitment
 *
 * The memorial tokenId equals the normieId of the departed Normie
 * (one memorial per departed).
 */
contract Normituary is ERC721, EIP712, Ownable {
    using ECDSA for bytes32;

    // ---------------------------------------------------------------
    // Config
    // ---------------------------------------------------------------

    uint256 public constant MOURNING_PERIOD = 30 days;

    /// @notice Project launch time — mourning baseline for retroactive burns
    uint256 public immutable launchTime;

    /// @notice Voucher signer (backend oracle)
    address public signer;

    /// @notice Mint price for the original burner. Can be 0.
    uint256 public mourningPrice = 0;

    /// @notice Public mint price after mourning ends
    uint256 public publicPrice = 0.02 ether;

    /// @notice Treasury address — receives all public mint proceeds
    address payable public constant TREASURY =
        payable(0xcaFE2E35cA942c6e4B81713b9C893aB546ac9BA4);

    /// @notice Base URI for the memorial renderer (backend / IPFS)
    string private _baseTokenURI;

    // ---------------------------------------------------------------
    // State
    // ---------------------------------------------------------------

    /// @notice normieId => already memorialized
    mapping(uint256 => bool) public memorialized;

    /// @notice normieId => death timestamp (recorded at mint, for tokenURI / queries)
    mapping(uint256 => uint256) public deathOf;

    uint256 public totalMinted;

    // ---------------------------------------------------------------
    // EIP-712
    // ---------------------------------------------------------------

    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "DeathVoucher(uint256 normieId,address burner,uint256 burnTimestamp,uint256 deadline)"
    );

    struct DeathVoucher {
        uint256 normieId;      // burned token id (0-9999)
        address burner;        // owner of the burn commitment on NormiesCanvas
        uint256 burnTimestamp; // on-chain timestamp of the burn
        uint256 deadline;      // voucher expiry
    }

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event MemorialMinted(
        uint256 indexed normieId,
        address indexed minter,
        bool duringMourning,
        uint256 burnTimestamp
    );

    // ---------------------------------------------------------------

    constructor(address _signer, string memory baseURI_)
        ERC721("Normituary Remembrance", "RIP")
        EIP712("Normituary", "1")
        Ownable(msg.sender)
    {
        signer = _signer;
        _baseTokenURI = baseURI_;
        launchTime = block.timestamp;
    }

    // ---------------------------------------------------------------
    // Mourning
    // ---------------------------------------------------------------

    /// @notice Returns the timestamp when a departed Normie's mourning period ends
    function mourningEnd(uint256 burnTimestamp) public view returns (uint256) {
        uint256 base = burnTimestamp > launchTime ? burnTimestamp : launchTime;
        return base + MOURNING_PERIOD;
    }

    /// @notice Returns true if the Normie is still in its mourning period
    function inMourning(uint256 burnTimestamp) public view returns (bool) {
        return block.timestamp < mourningEnd(burnTimestamp);
    }

    // ---------------------------------------------------------------
    // Mint
    // ---------------------------------------------------------------

    /**
     * @notice Mint as the original burner — free at any time, even after mourning ends.
     * @dev The voucher proves who burned and when. msg.sender must be the burner.
     */
    function mintAsMourner(DeathVoucher calldata v, bytes calldata sig)
        external
        payable
    {
        _verifyVoucher(v, sig);
        require(msg.sender == v.burner, "Normituary: mint reserved for the original burner");
        require(msg.value >= mourningPrice, "Normituary: insufficient payment");

        _memorialize(v, true);
    }

    /**
     * @notice Public mint — open to anyone after mourning ends.
     * @dev Proceeds are forwarded directly to the project treasury.
     */
    function mintPublic(DeathVoucher calldata v, bytes calldata sig)
        external
        payable
    {
        _verifyVoucher(v, sig);
        require(!inMourning(v.burnTimestamp), "Normituary: still in mourning period");
        require(msg.value >= publicPrice, "Normituary: insufficient payment");

        _memorialize(v, false);

        // Forward ETH directly to the project treasury
        (bool ok, ) = TREASURY.call{value: msg.value}("");
        require(ok, "Normituary: treasury transfer failed");
    }

    function _memorialize(DeathVoucher calldata v, bool duringMourning) internal {
        require(!memorialized[v.normieId], "Normituary: memorial already exists");
        require(v.normieId < 10000, "Normituary: invalid normie id");

        memorialized[v.normieId] = true;
        deathOf[v.normieId] = v.burnTimestamp;
        totalMinted++;

        // memorial tokenId = departed Normie id
        _safeMint(msg.sender, v.normieId);

        emit MemorialMinted(v.normieId, msg.sender, duringMourning, v.burnTimestamp);
    }

    function _verifyVoucher(DeathVoucher calldata v, bytes calldata sig)
        internal
        view
    {
        require(block.timestamp <= v.deadline, "Normituary: voucher expired");

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                VOUCHER_TYPEHASH,
                v.normieId,
                v.burner,
                v.burnTimestamp,
                v.deadline
            ))
        );
        require(digest.recover(sig) == signer, "Normituary: invalid signature");
    }

    // ---------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    function setPrices(uint256 _mourning, uint256 _public) external onlyOwner {
        mourningPrice = _mourning;
        publicPrice = _public;
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        _baseTokenURI = uri;
    }

    function withdraw() external onlyOwner {
        (bool ok, ) = msg.sender.call{value: address(this).balance}("");
        require(ok, "Normituary: withdraw failed");
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
