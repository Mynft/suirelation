import {
  bcs,
  RawSigner,
  SuiObjectChangeCreated,
  SuiObjectChangePublished,
  SuiObjectResponse,
  TransactionBlock,
} from '@mysten/sui.js';
import { connection, provider, publish, sendTx, signer } from './common';
import * as path from 'path';

const CLOCK_ADDR = '0x0000000000000000000000000000000000000000000000000000000000000006';

interface AppMeta {
  packageId: string;
  globalId: string;
}

let tx = new TransactionBlock();

async function publishSuiRelation(): Promise<AppMeta> {
  const publishTxn = await publish(path.join(__dirname, '.'), signer);
  const packageId = (publishTxn.objectChanges!.filter((o) => o.type === 'published')[0] as SuiObjectChangePublished)
    .packageId;
  const globalId = (
    publishTxn.objectChanges!.filter(
      (o) => o.type === 'created' && o.objectType.endsWith('::suirelation::Global'),
    )[0] as SuiObjectChangeCreated
  ).objectId;
  return {
    packageId,
    globalId,
  };
}

function generateRandomAddress(): string {
  const hexChars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return '0x' + result;
}

async function interact(appMeta: AppMeta, signer: RawSigner) {
  const { packageId, globalId } = appMeta;
  // follow
  let to = generateRandomAddress();
  tx = new TransactionBlock();
  tx.moveCall({
    target: `${packageId}::suirelation::follow`,
    arguments: [tx.object(globalId), tx.pure(to), tx.object(CLOCK_ADDR)],
  });
  tx.moveCall({
    target: `${packageId}::suirelation::follow`,
    arguments: [tx.object(globalId), tx.pure(generateRandomAddress()), tx.object(CLOCK_ADDR)],
  });
  const followTxn = await sendTx(tx, signer);
  console.log('followTxn', JSON.stringify(followTxn, null, 2));

  // unfollow
  tx = new TransactionBlock();
  tx.moveCall({
    target: `${packageId}::suirelation::unfollow`,
    arguments: [tx.object(globalId), tx.pure(to), tx.object(CLOCK_ADDR)],
  });
  const unfollowTxn = await sendTx(tx, signer);
  console.log('unfollowTxn', JSON.stringify(unfollowTxn, null, 2));
}

async function iterateTable(tableId: string, cb: (callback: SuiObjectResponse) => void) {
  let cursor: string | null = null;
  while (true) {
    const fields = await provider.getDynamicFields({
      parentId: tableId,
      cursor,
    });
    console.log(`fields: ${JSON.stringify(fields, null, 2)}`);
    for (const field of fields.data) {
      const object = await provider.getObject({
        id: field.objectId,
        options: {
          showContent: true,
        },
      });
      console.log(`object: ${JSON.stringify(object, null, 2)}`);
      cb(object);
    }
    if (!fields.hasNextPage) {
      break;
    }
    cursor = fields.nextCursor;
  }
}

async function queries(appMeta: AppMeta) {
  // query user's relationship
  const { packageId, globalId } = appMeta;
  const global = await provider.getObject({
    id: globalId,
    options: {
      showContent: true,
    },
  });
  console.log('global', JSON.stringify(global, null, 2));

  const userAddr = await signer.getAddress();
  const relationshipsTableId = (global.data!.content as any).fields.relationships.fields.id.id;
  const userRelationShip = await provider.getDynamicFieldObject({
    parentId: relationshipsTableId,
    name: {
      type: 'address',
      value: userAddr,
    },
  });
  console.log('userRelationShip', JSON.stringify(userRelationShip, null, 2));

  const followeeNum = (userRelationShip.data!.content as any).fields.value.fields.followees.fields.size;
  const followeeTableId = (userRelationShip.data!.content as any).fields.value.fields.followees.fields.id.id;
  const followerNum = (userRelationShip.data!.content as any).fields.value.fields.followers.fields.size;
  const followerTableId = (userRelationShip.data!.content as any).fields.value.fields.followers.fields.id.id;
  console.log(
    `followeeNum: ${followeeNum}, followeeTableId: ${followeeTableId}, followerNum: ${followerNum}, followerTableId: ${followerTableId}`,
  );

  // get followee list
  await iterateTable(followeeTableId, (object) => {
    const addr = (object.data!.content as any).fields.name;
    const tp = (object.data!.content as any).fields.value;
    console.log(`followee: ${addr}, follow at ${new Date(parseInt(tp))}`);
  });

  // check relationship
  tx = new TransactionBlock();
  tx.moveCall({
    target: `${packageId}::suirelation::check_relationship`,
    arguments: [tx.object(globalId), tx.pure(userAddr), tx.pure([userAddr, CLOCK_ADDR])],
  });
  const res = await provider.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: userAddr,
  });
  console.log('check_relationship', JSON.stringify((res.events! as any).parsedJson, null, 2));
}

async function main() {
  console.log('-----start-----');
  const addr = await signer.getAddress();
  console.log(`address: ${addr}`);
  // faucet
  if (process.env.REQUEST_SUI) {
    const res = await provider.requestSuiFromFaucet(addr);
    console.log('requestSuiFromFaucet', JSON.stringify(res, null, 2));
  }

  // publish
  const appMeta = await publishSuiRelation();
  // const appMeta = {
  //   packageId: '0x46a6b243a1a82a5936a9ddf025d3dddb2f533a5698dd03e581ff8bc38bf1a75f',
  //   globalId: '0xb86b56ebe752bece24946711acfca97de21bf25c406f78e7afb1e1c6c09b568d',
  // };
  console.log(`appMeta: ${JSON.stringify(appMeta, null, 2)}`);

  // txs
  await interact(appMeta, signer);
  await queries(appMeta);
  console.log('-----end-----');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`error: ${JSON.stringify(error, null, 2)}, ${error.stack}`);
    process.exit(1);
  });
