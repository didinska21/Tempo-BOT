// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleERC20 is ERC20, Ownable {
    uint8 private _decimals;
    // NOTE: pass initial owner to Ownable constructor
    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 initialSupply) 
        ERC20(name_, symbol_) 
        Ownable(msg.sender) 
    {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
