# Sui Relation

## Quick Start

Install package: `npm install @suia/suirelation`

Usage example:

```typescript
import { SuiRelation } from '@suia/suirelation';
import { devnetConnection, Ed25519Keypair, JsonRpcProvider, RawSigner } from '@mysten/sui.js';

async function main(): Promise<void> {
  // init connection and signer
  const connection = devnetConnection;
  const provider = new JsonRpcProvider(connection);
  const keypairseed = process.env.KEY_PAIR_SEED;
  const keypair = Ed25519Keypair.fromSecretKey(Uint8Array.from(Buffer.from(keypairseed!, 'hex')));
  const signer = new RawSigner(keypair, provider);

  const addr = await signer.getAddress();

  // initiate a new sui relation class
  const suiRelation = new SuiRelation(
    {
      packageId: '0x7da55679da617eef5c992aaa3d89cca803826ad4408f24f6c267d2b58bb51cbd',
      globalObjectId: '0x512b0092665ee0077b00ab51eb6c6695aec408b0352ba4f09919ca68ef41c9c4',
    },
    provider,
  );

  // get the relation number of the address
  const relationNum = await suiRelation.getRelationNum(addr);
  console.log('relationNum: ', JSON.stringify(relationNum, null, 2));

  // follow and unfollow an address
  const followTxnRes = await suiRelation.follow(to, signer);
  console.log('followTxnRes: ', JSON.stringify(followTxnRes, null, 2));

  const unfollowTxnRes = await suiRelation.unfollow(to, signer);
  console.log('unfollowTxnRes: ', JSON.stringify(unfollowTxnRes, null, 2));

  // get the followings and followers of an address
  const followings = await suiRelation.getFollowings(addr, { limit: 1 });
  console.log('followings: ', JSON.stringify(followings, null, 2));

  const followers = await suiRelation.getFollowers(followings.followings[0]);
  console.log('followers: ', JSON.stringify(followers, null, 2));
}
```
