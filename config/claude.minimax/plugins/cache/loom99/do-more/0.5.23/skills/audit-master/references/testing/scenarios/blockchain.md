# Blockchain / Smart Contract Testing Scenario

Testing Solidity smart contracts, Web3 applications, and blockchain integrations.

## Unique Challenges

Smart contract testing has unique requirements:
- **Immutability**: Bugs can't be patched after deployment
- **Financial risk**: Vulnerabilities lead to direct monetary loss
- **Gas optimization**: Code efficiency affects cost
- **State complexity**: Contract state transitions
- **Security criticality**: Common attack vectors (reentrancy, overflow)

## Testing Pyramid for Smart Contracts

```
         ╱╲
        ╱Audit╲         Manual security review + formal verification
       ╱────────╲
      ╱   E2E    ╲      Testnet deployment, real transactions
     ╱────────────╲
    ╱  Integration ╲    Multi-contract, fork testing
   ╱────────────────╲
  ╱      Unit        ╲   Individual functions, modifiers
 ╱────────────────────╲
```

| Level | What to Test | Environment |
|-------|--------------|-------------|
| Unit | Functions, modifiers | Local Hardhat/Foundry |
| Integration | Contract interactions | Forked mainnet |
| E2E | Full dApp flow | Testnet |
| Audit | Security, formal verification | Tools + manual |

## Critical Test Areas

### 1. Basic Functionality (Hardhat/Ethers.js)

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Token", () => {
  let token: Contract;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("MyToken", "MTK", 1000000);
  });

  it("should have correct initial supply", async () => {
    const totalSupply = await token.totalSupply();
    expect(totalSupply).to.equal(1000000);
  });

  it("should transfer tokens between accounts", async () => {
    await token.transfer(user.address, 100);

    expect(await token.balanceOf(user.address)).to.equal(100);
    expect(await token.balanceOf(owner.address)).to.equal(999900);
  });

  it("should fail transfer if insufficient balance", async () => {
    await expect(
      token.connect(user).transfer(owner.address, 100)
    ).to.be.revertedWith("Insufficient balance");
  });
});
```

### 2. Foundry Testing (Solidity Tests)

```solidity
// test/Token.t.sol
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Token.sol";

contract TokenTest is Test {
    Token token;
    address owner = address(this);
    address user = address(0x1);

    function setUp() public {
        token = new Token("MyToken", "MTK", 1000000);
    }

    function testInitialSupply() public {
        assertEq(token.totalSupply(), 1000000);
    }

    function testTransfer() public {
        token.transfer(user, 100);

        assertEq(token.balanceOf(user), 100);
        assertEq(token.balanceOf(owner), 999900);
    }

    function testTransferInsufficientBalance() public {
        vm.prank(user);  // Act as user
        vm.expectRevert("Insufficient balance");
        token.transfer(owner, 100);
    }

    // Fuzz testing
    function testFuzz_Transfer(uint256 amount) public {
        vm.assume(amount <= 1000000);

        token.transfer(user, amount);

        assertEq(token.balanceOf(user), amount);
    }
}
```

### 3. Security Testing

```solidity
// Reentrancy attack test
contract ReentrancyTest is Test {
    Vault vault;
    AttackerContract attacker;

    function setUp() public {
        vault = new Vault();
        attacker = new AttackerContract(address(vault));

        // Fund vault
        vault.deposit{value: 10 ether}();
    }

    function testReentrancyProtection() public {
        attacker.deposit{value: 1 ether}();

        vm.expectRevert();
        attacker.attack();

        // Vault funds should be intact
        assertEq(address(vault).balance, 11 ether);
    }
}

contract AttackerContract {
    Vault vault;

    constructor(address _vault) {
        vault = Vault(_vault);
    }

    function attack() external {
        vault.withdraw(1 ether);
    }

    receive() external payable {
        // Reentrant call
        if (address(vault).balance >= 1 ether) {
            vault.withdraw(1 ether);
        }
    }
}
```

### 4. Access Control Testing

```typescript
describe("Access Control", () => {
  it("only owner can mint", async () => {
    await expect(
      token.connect(user).mint(user.address, 1000)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("only admin can pause", async () => {
    await expect(
      token.connect(user).pause()
    ).to.be.revertedWith("AccessControl: missing role");
  });

  it("granted role can perform action", async () => {
    await token.grantRole(MINTER_ROLE, user.address);

    await token.connect(user).mint(user.address, 1000);

    expect(await token.balanceOf(user.address)).to.equal(1000);
  });
});
```

### 5. Gas Optimization Testing

```typescript
describe("Gas Usage", () => {
  it("transfer uses reasonable gas", async () => {
    const tx = await token.transfer(user.address, 100);
    const receipt = await tx.wait();

    expect(receipt.gasUsed).to.be.lessThan(60000);
  });

  it("batch transfer is more efficient", async () => {
    const addresses = Array(10).fill(user.address);
    const amounts = Array(10).fill(100);

    // Single transfers
    let singleGas = BigNumber.from(0);
    for (let i = 0; i < 10; i++) {
      const tx = await token.transfer(addresses[i], amounts[i]);
      const receipt = await tx.wait();
      singleGas = singleGas.add(receipt.gasUsed);
    }

    // Reset state
    await token.transferFrom(user.address, owner.address, 1000);

    // Batch transfer
    const batchTx = await token.batchTransfer(addresses, amounts);
    const batchReceipt = await batchTx.wait();

    expect(batchReceipt.gasUsed).to.be.lessThan(singleGas);
  });
});
```

### 6. Fork Testing (Mainnet Fork)

```typescript
import { reset } from "@nomicfoundation/hardhat-network-helpers";

describe("Mainnet Fork Tests", () => {
  beforeEach(async () => {
    await reset(
      `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      BLOCK_NUMBER
    );
  });

  it("interacts with real Uniswap", async () => {
    const uniswap = await ethers.getContractAt(
      "IUniswapV2Router",
      UNISWAP_ROUTER
    );

    const amountOut = await uniswap.getAmountsOut(
      ethers.utils.parseEther("1"),
      [WETH, USDC]
    );

    expect(amountOut[1]).to.be.gt(0);
  });

  it("whale can transfer tokens", async () => {
    const whale = "0x...";  // Known large holder
    await impersonateAccount(whale);

    const whaleSigner = await ethers.getSigner(whale);
    const usdc = await ethers.getContractAt("IERC20", USDC);

    await usdc.connect(whaleSigner).transfer(user.address, 1000000);

    expect(await usdc.balanceOf(user.address)).to.equal(1000000);
  });
});
```

### 7. Invariant Testing (Foundry)

```solidity
contract TokenInvariantTest is Test {
    Token token;
    Handler handler;

    function setUp() public {
        token = new Token("Test", "TST", 1000000);
        handler = new Handler(token);

        // Target the handler for fuzzing
        targetContract(address(handler));
    }

    // This should always be true
    function invariant_totalSupplyNeverChanges() public {
        assertEq(token.totalSupply(), 1000000);
    }

    function invariant_balancesSumToTotal() public {
        uint256 total = 0;
        for (uint i = 0; i < handler.actorsCount(); i++) {
            total += token.balanceOf(handler.actors(i));
        }
        assertEq(total, token.totalSupply());
    }
}

contract Handler is Test {
    Token token;
    address[] public actors;

    constructor(Token _token) {
        token = _token;
        actors.push(address(this));
    }

    function transfer(uint256 actorSeed, uint256 amount) external {
        address to = actors[actorSeed % actors.length];
        amount = bound(amount, 0, token.balanceOf(msg.sender));

        token.transfer(to, amount);
    }
}
```

### 8. Event Testing

```typescript
describe("Events", () => {
  it("emits Transfer event", async () => {
    await expect(token.transfer(user.address, 100))
      .to.emit(token, "Transfer")
      .withArgs(owner.address, user.address, 100);
  });

  it("emits multiple events in order", async () => {
    await expect(token.transferWithFee(user.address, 100))
      .to.emit(token, "Transfer")
      .withArgs(owner.address, user.address, 95)
      .and.to.emit(token, "FeeCollected")
      .withArgs(5);
  });
});
```

## Integration Testing

### Multi-Contract Interactions

```typescript
describe("DeFi Integration", () => {
  let token: Contract;
  let vault: Contract;
  let oracle: Contract;

  beforeEach(async () => {
    // Deploy ecosystem
    oracle = await deployOracle();
    token = await deployToken();
    vault = await deployVault(token.address, oracle.address);
  });

  it("complete deposit/withdraw cycle", async () => {
    // Approve
    await token.approve(vault.address, 1000);

    // Deposit
    await vault.deposit(1000);
    expect(await vault.balanceOf(owner.address)).to.be.gt(0);

    // Withdraw
    await vault.withdraw(await vault.balanceOf(owner.address));
    expect(await token.balanceOf(owner.address)).to.equal(1000);
  });
});
```

## Coverage Expectations

### Unit Tests (Exhaustive)
- [ ] All public/external functions
- [ ] All require/revert conditions
- [ ] Edge cases (0, max values)
- [ ] Access control
- [ ] Events emitted correctly

### Integration Tests (High)
- [ ] Multi-contract interactions
- [ ] Real protocol interactions (fork)
- [ ] Upgrade paths (if upgradeable)

### Security Tests (Critical)
- [ ] Reentrancy protection
- [ ] Integer overflow/underflow
- [ ] Access control bypass
- [ ] Flash loan attacks
- [ ] Oracle manipulation

### Invariant Tests
- [ ] Total supply invariants
- [ ] Balance consistency
- [ ] State machine validity

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| No fork tests | Miss real-world interactions | Test against mainnet fork |
| Ignoring gas | Expensive to use | Benchmark gas in tests |
| No fuzz testing | Miss edge cases | Use Foundry fuzz tests |
| Testing only happy path | Security holes | Test attack vectors |
| No invariant tests | State corruption bugs | Define and test invariants |

## Tools

| Tool | Purpose |
|------|---------|
| Hardhat | Development framework |
| Foundry | Fast testing, fuzzing |
| Slither | Static analysis |
| Mythril | Security analysis |
| Echidna | Fuzzing |

## Test Structure

```
contracts/
├── src/
│   ├── Token.sol
│   └── Vault.sol
├── test/
│   ├── unit/
│   │   ├── Token.test.ts
│   │   └── Vault.test.ts
│   ├── integration/
│   │   └── DeFi.test.ts
│   ├── security/
│   │   └── Attacks.test.ts
│   └── invariant/
│       └── Token.invariant.t.sol
└── hardhat.config.ts
```

## CI Configuration

```yaml
jobs:
  test:
    steps:
      - name: Unit Tests
        run: npx hardhat test

      - name: Foundry Tests
        run: forge test

      - name: Coverage
        run: npx hardhat coverage

      - name: Slither Analysis
        run: slither .

      - name: Gas Report
        run: npx hardhat test --gas-report
```
