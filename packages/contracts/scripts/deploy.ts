import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MON");

  const PoKAnchor = await ethers.getContractFactory("PoKAnchor");
  const contract = await PoKAnchor.deploy();
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("PoKAnchor deployed to:", addr);
  console.log("Monad testnet explorer: https://testnet.monadexplorer.com/address/" + addr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
