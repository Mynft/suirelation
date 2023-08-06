import { JsonRpcProvider, RawSigner, SuiAddress, SuiObjectResponse, TransactionBlock } from '@mysten/sui.js';
import { provider } from '../examples/common';
import { SuiTransactionBlockResponse } from '@mysten/sui.js/src/types';

const CLOCK_ADDR = '0x0000000000000000000000000000000000000000000000000000000000000006';

export interface RelationContractConfig {
  packageId: string;
  globalObjectId: string;
}

export interface UserRelationNum {
  user: SuiAddress;
  followingNum: number;
  followerNum: number;
}

export interface Options {
  cursor?: string;
  limit?: number | null;
}

export interface FollowingsResult {
  followings: string[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface FollowersResult {
  followers: string[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export class SuiRelation {
  readonly packageId: string;
  readonly globalObjectId: string;
  readonly provider: JsonRpcProvider;

  relationshipsTableId: string | null = null;

  constructor(relationContractConfig: RelationContractConfig, provider: JsonRpcProvider) {
    this.packageId = relationContractConfig.packageId;
    this.globalObjectId = relationContractConfig.globalObjectId;
    this.provider = provider;
  }

  private async getRelationshipsTableId(): Promise<string> {
    if (this.relationshipsTableId) {
      return this.relationshipsTableId;
    }
    const global = await provider.getObject({
      id: this.globalObjectId,
      options: {
        showContent: true,
      },
    });
    this.relationshipsTableId = (global.data!.content as any).fields.relationships.fields.id.id;
    return this.relationshipsTableId!;
  }

  private async getUserRelationShip(user: SuiAddress): Promise<SuiObjectResponse | null> {
    const relationshipsTableId = await this.getRelationshipsTableId();
    const userRelationShip = await provider.getDynamicFieldObject({
      parentId: relationshipsTableId,
      name: {
        type: 'address',
        value: user,
      },
    });
    if (userRelationShip.error) {
      if (userRelationShip.error.code === 'dynamicFieldNotFound') {
        return null;
      }
      throw new Error(`get user relation error: ${JSON.stringify(userRelationShip.error)}`);
    }
    return userRelationShip;
  }

  private async sendTransaction(txb: TransactionBlock, signer: RawSigner): Promise<SuiTransactionBlockResponse> {
    const res = await signer.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      options: {
        showInput: true,
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });
    return res;
  }

  async follow(to: SuiAddress, signer: RawSigner): Promise<SuiTransactionBlockResponse> {
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${this.packageId}::suirelation::follow`,
      arguments: [tx.object(this.globalObjectId), tx.pure(to), tx.object(CLOCK_ADDR)],
    });
    return this.sendTransaction(tx, signer);
  }

  async unfollow(to: SuiAddress, signer: RawSigner): Promise<SuiTransactionBlockResponse> {
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${this.packageId}::suirelation::unfollow`,
      arguments: [tx.object(this.globalObjectId), tx.pure(to), tx.object(CLOCK_ADDR)],
    });
    return this.sendTransaction(tx, signer);
  }

  async getRelationNum(user: SuiAddress): Promise<UserRelationNum> {
    const userRelationShip = await this.getUserRelationShip(user);
    if (!userRelationShip) {
      return {
        user,
        followingNum: 0,
        followerNum: 0,
      };
    }
    const followingNum: number = (userRelationShip.data!.content as any).fields.value.fields.followings.fields.size;
    const followerNum: number = (userRelationShip.data!.content as any).fields.value.fields.followers.fields.size;
    return {
      user,
      followingNum,
      followerNum,
    };
  }

  async getFollowings(user: SuiAddress, options: Options = {}): Promise<FollowingsResult> {
    const userRelationShip = await this.getUserRelationShip(user);
    if (!userRelationShip) {
      return {
        followings: [],
        nextCursor: null,
        hasNextPage: false,
      };
    }
    const followingTableId = (userRelationShip.data!.content as any).fields.value.fields.followings.fields.id.id;
    const fields = await this.provider.getDynamicFields({
      parentId: followingTableId,
      cursor: options.cursor,
      limit: options.limit,
    });
    const res: FollowingsResult = {
      followings: fields.data.map((f) => f.name.value as string),
      nextCursor: fields.nextCursor,
      hasNextPage: fields.hasNextPage,
    };
    return res;
  }

  async getFollowers(user: SuiAddress, options: Options = {}): Promise<FollowersResult> {
    const userRelationShip = await this.getUserRelationShip(user);
    if (!userRelationShip) {
      return {
        followers: [],
        nextCursor: null,
        hasNextPage: false,
      };
    }
    const followerTableId = (userRelationShip.data!.content as any).fields.value.fields.followers.fields.id.id;
    const fields = await this.provider.getDynamicFields({
      parentId: followerTableId,
      cursor: options.cursor,
      limit: options.limit,
    });
    const res: FollowersResult = {
      followers: fields.data.map((f) => f.name.value as string),
      nextCursor: fields.nextCursor,
      hasNextPage: fields.hasNextPage,
    };
    return res;
  }
}
