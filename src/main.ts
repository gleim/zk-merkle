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

import { MerkleTreeContract } from './MerkleTreeContract.js';

await isReady;

// --------------------------------------

class Point extends Struct({ x: Field, y: Field }) {
  static add(a: Point, b: Point) {
    return { x: a.x.add(b.x), y: a.y.add(b.y) };
  }
}

const point1 = { x: Field(10), y: Field(4) };
const point2 = { x: Field(1), y: Field(2) };

const pointSum = Point.add(point1, point2);

console.log(`pointSum Fields: ${Point.toFields(pointSum)}`);

class Points4 extends Struct({
  points: [Point, Point, Point, Point],
}) {}

const points = new Array(4)
  .fill(null)
  .map((_, i) => ({ x: Field(i), y: Field(i * 10) }));
const points4: Points4 = { points };

console.log(`points4 JSON: ${JSON.stringify(points4)}`);

// --------------------------------------

const zkAppPrivateKey = PrivateKey.random();
const zkAppPublicKey = zkAppPrivateKey.toPublicKey();

const data = CircuitString.fromString(JSON.stringify(points4)).toFields();

const signature = Signature.create(zkAppPrivateKey, data);

const verifiedData = signature.verify(zkAppPublicKey, data).toString();

console.log(`private key: ${zkAppPrivateKey.toBase58()}`);
console.log(`public key: ${zkAppPublicKey.toBase58()}`);

console.log(`Fields in private key: ${zkAppPrivateKey.toFields().length}`);
console.log(`Fields in public key: ${zkAppPublicKey.toFields().length}`);

console.log(`verified data: ${verifiedData}`);

console.log(`Fields in signature: ${signature.toFields().length}`);
console.log('--------------------------------------');

// --------------------------------------

const Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);
const { privateKey: deployerKey, publicKey: deployerAccount } =
  Local.testAccounts[0];
const { privateKey: senderPrivateKey, publicKey: senderPublicKey } =
  Local.testAccounts[1];

// --------------------------------------
// create a new merkle tree and BasicMerkleTreeContract zkapp account

{
  const basicTreeZkAppPrivateKey = PrivateKey.random();
  const basicTreeZkAppAddress = basicTreeZkAppPrivateKey.toPublicKey();

  // initialize the zkapp
  const zkApp = new MerkleTreeContract(basicTreeZkAppAddress);
  await MerkleTreeContract.compile();

  // create a new tree
  const height = 20;
  const tree = new MerkleTree(height);
  class MerkleWitness20 extends MerkleWitness(height) {}

  // deploy the smart contract
  const deployTxn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkApp.deploy();
    // get the root of the new tree to use as the initial tree root
    zkApp.initState(tree.getRoot());
  });
  await deployTxn.prove();
  deployTxn.sign([deployerKey, basicTreeZkAppPrivateKey]);

  const pendingDeployTx = await deployTxn.send();
  /**
   * `txn.send()` returns a pending transaction with two methods - `.wait()` and `.hash()`
   * `.hash()` returns the transaction hash
   * `.wait()` automatically resolves once the transaction has been included in a block. this is redundant for the LocalBlockchain, but very helpful for live testnets
   */
  await pendingDeployTx.wait();

  const incrementIndex = 522n;
  const incrementAmount = Field(9);

  // get the witness for the current tree
  const witness = new MerkleWitness20(tree.getWitness(incrementIndex));

  // update the leaf locally
  tree.setLeaf(incrementIndex, incrementAmount);

  // update the smart contract
  const txn1 = await Mina.transaction(senderPublicKey, () => {
    zkApp.update(
      witness,
      Field(0), // leafs in new trees start at a state of 0
      incrementAmount
    );
  });
  await txn1.prove();
  const pendingTx = await txn1.sign([senderPrivateKey, zkAppPrivateKey]).send();
  await pendingTx.wait();

  // compare the root of the smart contract tree to our local tree
  console.log(
    `BasicMerkleTree: local tree root hash after send1: ${tree.getRoot()}`
  );
  console.log(
    `BasicMerkleTree: smart contract root hash after send1: ${zkApp.treeRoot.get()}`
  );
}

console.log('--------------------------------------');
// --------------------------------------
// create a new merkle tree and LedgerContract zkapp account

{
  const ledgerZkAppPrivateKey = PrivateKey.random();
  const ledgerZkAppAddress = ledgerZkAppPrivateKey.toPublicKey();

  const height = 20;
  const tree = new MerkleTree(height);
  class MerkleWitness20 extends MerkleWitness(height) {}

  const senderInitialBalance = Field(100);
  const recipientInitialBalance = Field(7);

  const recipientPrivateKey = PrivateKey.random();
  const recipientPublicKey = recipientPrivateKey.toPublicKey();

  const senderAccount = 10n;
  const recipientAccount = 500n;

  tree.setLeaf(
    senderAccount,
    Poseidon.hash([
      senderInitialBalance,
      Poseidon.hash(senderPublicKey.toFields()),
    ])
  );
  tree.setLeaf(
    recipientAccount,
    Poseidon.hash([
      recipientInitialBalance,
      Poseidon.hash(recipientPublicKey.toFields()),
    ])
  );
}

// --------------------------------------
console.log('--------------------------------------');

const map = new MerkleMap();

const key = Field(100);
const value = Field(50);

map.set(key, value);

console.log(`value for key ${key}: ${map.get(key)}`);

// --------------------------------------

await shutdown();
