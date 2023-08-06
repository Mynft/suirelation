import { SuiRelation } from '../src/suirelation';
import { devnetConnection, Ed25519Keypair, JsonRpcProvider, RawSigner } from '@mysten/sui.js';

function generateRandomAddress(): string {
  const hexChars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return '0x' + result;
}

async function main(): Promise<void> {
  console.log('Hello from SuiRelation');

  // init connection and signer
  const connection = devnetConnection;
  const provider = new JsonRpcProvider(connection);
  const keypairseed = process.env.KEY_PAIR_SEED;
  const keypair = Ed25519Keypair.fromSecretKey(Uint8Array.from(Buffer.from(keypairseed!, 'hex')));
  const signer = new RawSigner(keypair, provider);

  const addr = await signer.getAddress();
  console.log('addr: ', addr);
  // await provider.requestSuiFromFaucet(addr);

  // wait for the faucet to send the sui
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const suiRelation = new SuiRelation(
    {
      packageId: '0x7da55679da617eef5c992aaa3d89cca803826ad4408f24f6c267d2b58bb51cbd',
      globalObjectId: '0x512b0092665ee0077b00ab51eb6c6695aec408b0352ba4f09919ca68ef41c9c4',
    },
    provider,
  );

  const randomAddr = generateRandomAddress();

  const relationNum = await suiRelation.getRelationNum(addr);
  console.log('relationNum: ', JSON.stringify(relationNum, null, 2));

  const relationNum2 = await suiRelation.getRelationNum(randomAddr);
  console.log('relationNum2: ', JSON.stringify(relationNum2, null, 2));

  const to = generateRandomAddress();
  const followTxnRes = await suiRelation.follow(to, signer);
  console.log('followTxnRes: ', JSON.stringify(followTxnRes, null, 2));

  const unfollowTxnRes = await suiRelation.unfollow(to, signer);
  console.log('unfollowTxnRes: ', JSON.stringify(unfollowTxnRes, null, 2));

  const followings = await suiRelation.getFollowings(addr, { limit: 1 });
  console.log('followings: ', JSON.stringify(followings, null, 2));

  const followings2 = await suiRelation.getFollowings(randomAddr, { limit: 1 });
  console.log('followings2: ', JSON.stringify(followings2, null, 2));

  const followers = await suiRelation.getFollowers(followings.followings[0]);
  console.log('followers: ', JSON.stringify(followers, null, 2));

  console.log('----------- SuiRelation example end -----------');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
