// scripts/deploy.js (ethers v6 style)
async function main() {
    const TraceFactory = await ethers.getContractFactory("Traceability");
    const trace = await TraceFactory.deploy();
  
    // Wait for the deployment tx to be mined
    await trace.waitForDeployment();
  
    // Get the deployed address (v6)
    const addr = await trace.getAddress();
    console.log("Traceability deployed to:", addr);
  }
  
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
  