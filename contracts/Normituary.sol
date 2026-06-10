// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title Normituary — Remembrance
 * @notice Memorial NFTs para Normies queimados via NormiesCanvas.
 *
 * Modelo hibrido:
 *  - PERIODO DE LUTO (30 dias por Normie): apenas quem queimou o Normie
 *    pode mintar o memorial, gratis (so gas) ou a preco simbolico.
 *  - APOS O LUTO: mint aberto ao publico, preco cheio.
 *
 * O luto de cada Normie comeca em max(timestampDoBurn, launchTime),
 * garantindo que queimadores antigos (pre-lancamento) tenham seus 30 dias.
 *
 * Prova de morte: voucher EIP-712 assinado pelo backend (oraculo), que
 * verifica o burn via Ponder/NormiesAPI antes de assinar:
 *   - normieId foi de fato queimado (commit revelado, nao expirado)
 *   - burner = owner do burn commitment
 *   - burnTimestamp = timestamp on-chain do commit
 *
 * O tokenId do memorial = normieId do Normie morto (1 memorial por morto).
 */
contract Normituary is ERC721, EIP712, Ownable {
    using ECDSA for bytes32;

    // ---------------------------------------------------------------
    // Config
    // ---------------------------------------------------------------

    uint256 public constant LUTO = 30 days;

    /// @notice Inicio do projeto — base do luto para burns retroativos
    uint256 public immutable launchTime;

    /// @notice Assinante dos vouchers (backend no VPS)
    address public signer;

    /// @notice Preco durante o luto (queimador). Pode ser 0.
    uint256 public mourningPrice = 0;

    /// @notice Preco do mint publico pos-luto
    uint256 public publicPrice = 0.01 ether;

    /// @notice Base URI do renderer de memoriais (backend / IPFS)
    string private _baseTokenURI;

    // ---------------------------------------------------------------
    // Estado
    // ---------------------------------------------------------------

    /// @notice normieId => ja memorializado
    mapping(uint256 => bool) public memorialized;

    /// @notice normieId => timestamp da morte (gravado no mint, p/ tokenURI/consulta)
    mapping(uint256 => uint256) public deathOf;

    uint256 public totalMinted;

    // ---------------------------------------------------------------
    // EIP-712
    // ---------------------------------------------------------------

    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "DeathVoucher(uint256 normieId,address burner,uint256 burnTimestamp,uint256 deadline)"
    );

    struct DeathVoucher {
        uint256 normieId;      // token queimado (0-9999)
        address burner;        // owner do burn commitment no NormiesCanvas
        uint256 burnTimestamp; // timestamp on-chain do burn
        uint256 deadline;      // validade do voucher
    }

    // ---------------------------------------------------------------
    // Eventos
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
    // Luto
    // ---------------------------------------------------------------

    /// @notice Fim do periodo de luto de um Normie morto
    function mourningEnd(uint256 burnTimestamp) public view returns (uint256) {
        uint256 base = burnTimestamp > launchTime ? burnTimestamp : launchTime;
        return base + LUTO;
    }

    /// @notice True se o Normie ainda esta em periodo de luto
    function inMourning(uint256 burnTimestamp) public view returns (bool) {
        return block.timestamp < mourningEnd(burnTimestamp);
    }

    // ---------------------------------------------------------------
    // Mint
    // ---------------------------------------------------------------

    /**
     * @notice Mint durante o luto — exclusivo do queimador.
     * @dev O voucher prova quem queimou e quando. msg.sender deve ser o burner.
     */
    function mintAsMourner(DeathVoucher calldata v, bytes calldata sig)
        external
        payable
    {
        _verifyVoucher(v, sig);
        require(msg.sender == v.burner, "Normituary: luto e so de quem queimou");
        require(inMourning(v.burnTimestamp), "Normituary: luto encerrado, use mint publico");
        require(msg.value >= mourningPrice, "Normituary: valor insuficiente");

        _memorialize(v, true);
    }

    /**
     * @notice Mint publico — qualquer um, apos o fim do luto.
     */
    function mintPublic(DeathVoucher calldata v, bytes calldata sig)
        external
        payable
    {
        _verifyVoucher(v, sig);
        require(!inMourning(v.burnTimestamp), "Normituary: ainda em periodo de luto");
        require(msg.value >= publicPrice, "Normituary: valor insuficiente");

        _memorialize(v, false);
    }

    function _memorialize(DeathVoucher calldata v, bool duringMourning) internal {
        require(!memorialized[v.normieId], "Normituary: memorial ja existe");
        require(v.normieId < 10000, "Normituary: id invalido");

        memorialized[v.normieId] = true;
        deathOf[v.normieId] = v.burnTimestamp;
        totalMinted++;

        // tokenId do memorial = id do Normie morto
        _safeMint(msg.sender, v.normieId);

        emit MemorialMinted(v.normieId, msg.sender, duringMourning, v.burnTimestamp);
    }

    function _verifyVoucher(DeathVoucher calldata v, bytes calldata sig)
        internal
        view
    {
        require(block.timestamp <= v.deadline, "Normituary: voucher expirado");

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                VOUCHER_TYPEHASH,
                v.normieId,
                v.burner,
                v.burnTimestamp,
                v.deadline
            ))
        );
        require(digest.recover(sig) == signer, "Normituary: assinatura invalida");
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
        require(ok, "Normituary: withdraw falhou");
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
