// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleERC721 is ERC721, Ownable {
    uint256 public nextId;
    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {
        nextId = 1;
    }
    function mint(address to) external returns (uint256) {
        uint256 id = nextId++;
        _safeMint(to, id);
        return id;
    }
}
