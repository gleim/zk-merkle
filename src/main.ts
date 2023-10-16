import {
  Mina,
  isReady,
  shutdown,
  UInt32,
  UInt64,
  Int64,
  Character,
  CircuitString,
  PrivateKey,
  Signature,
  Poseidon,
  Field,
  Provable,
  MerkleWitness,
  MerkleTree,
  AccountUpdate,
  Struct,
  MerkleMap,
  Bool,
} from 'o1js';

import { MerkleRootStorageContract } from './MerkleRootStorageContract.js';

await isReady;

// --------------------------------------

const zkAppPrivateKey = PrivateKey.random();
const zkAppPublicKey = zkAppPrivateKey.toPublicKey();

console.log(`private key: ${zkAppPrivateKey.toBase58()}`);
console.log(`public key: ${zkAppPublicKey.toBase58()}`);

console.log(`Fields in private key: ${zkAppPrivateKey.toFields().length}`);
console.log(`Fields in public key: ${zkAppPublicKey.toFields().length}`);

// --------------------------------------

const Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);
const { privateKey: deployerKey, publicKey: deployerAccount } =
  Local.testAccounts[0];
const { privateKey: senderPrivateKey, publicKey: senderPublicKey } =
  Local.testAccounts[1];

// --------------------------------------
// create a new merkle map and MerkleMapContract zkapp account

{
  const mapZkAppPrivateKey = PrivateKey.random();
  const mapZkAppAddress = mapZkAppPrivateKey.toPublicKey();

  // initialize the zkapp
  const zkApp = new MerkleRootStorageContract(mapZkAppAddress);
  await MerkleRootStorageContract.compile();

  // deploy the smart contract
  const deployTxn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkApp.deploy();
    // get the root of the new tree to use as the initial tree root
    zkApp.initState(Field(0));
  });
  await deployTxn.prove();
  deployTxn.sign([deployerKey, mapZkAppPrivateKey]);

  const pendingDeployTx = await deployTxn.send();
  /**
   * `txn.send()` returns a pending transaction with two methods - `.wait()` and `.hash()`
   * `.hash()` returns the transaction hash
   * `.wait()` automatically resolves once the transaction has been included in a block. this is redundant for the LocalBlockchain, but very helpful for live testnets
   */
  await pendingDeployTx.wait();

  // update the smart contract
  const txn1 = await Mina.transaction(senderPublicKey, () => {
    zkApp.update(Field(2));
  });
  await txn1.prove();
  const pendingTx = await txn1.sign([senderPrivateKey, zkAppPrivateKey]).send();
  await pendingTx.wait();

  // view the map of the smart contract
  console.log(
    `Merkle tree root storage: smart contract map after send1: ${zkApp.root.get()}`
  );
}

console.log('--------------------------------------');

await shutdown();
