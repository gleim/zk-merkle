import { Field, SmartContract, state, State, method, MerkleMap } from 'o1js';

export class MerkleRootStorageContract extends SmartContract {
  @state(Field) root = State<Field>();

  @method initState(initialRoot: Field) {
    this.root.set(initialRoot);
  }

  @method update(newRoot: Field) {
    // validate previous state for o1js consistency
    const root = this.root.get();
    this.root.assertEquals(root);

    // set the new Merkle tree root
    this.root.set(newRoot);
  }
}
