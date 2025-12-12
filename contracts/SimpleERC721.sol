// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleERC721 is ERC721, Ownable {
    uint256 public nextId;

    // pass initial owner to Ownable constructor
    constructor(string memory name_, string memory symbol_) 
        ERC721(name_, symbol_) 
        Ownable(msg.sender) 
    {
        nextId = 1;
    }

    // only owner can mint (deployer)
    function mint(address to) external onlyOwner returns (uint256) {
        uint256 id = nextId++;
        _safeMint(to, id);
        return id;
    }
}
