module suirelation::suirelation {
    use sui::clock::{Clock, timestamp_ms};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::table::{Self, Table};
    use sui::transfer::share_object;
    use sui::tx_context::{TxContext, sender};
    use std::vector;

    // errors
    const EALREADY_FOLLOWED: u64 = 1;
    const ENOT_FOLLOWED: u64 = 2;
    const ENO_RELATIONSHIP_FOUND_FOR_FROM: u64 = 3;
    const ENO_RELATIONSHIP_FOUND_FOR_TO: u64 = 4;

    struct Global has key, store {
        id: UID,
        relationships: Table<address, RelationShip>,
    }

    struct RelationShip has store {
        followers: Table<address, u64>,
        followees: Table<address, u64>,
    }

    // ====== Events ======
    struct FollowEvent has copy, drop {
        from: address,
        to: address,
        timestamp_ms: u64,
    }

    struct UnfollowEvent has copy, drop {
        from: address,
        to: address,
        timestamp_ms: u64,
    }

    struct RelationEvent has copy, drop {
        to: address,
        is_follower: bool,
        is_followee: bool,
    }

    struct CheckRelationshipEvent has copy, drop {
        from: address,
        to_relationships: vector<RelationEvent>,
    }

    fun init(ctx: &mut TxContext) {
        let global = Global {
            id: object::new(ctx),
            relationships: table::new(ctx),
        };
        share_object(global)
    }

    public entry fun follow(
        global: &mut Global,
        to: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let from = sender(ctx);
        let now = timestamp_ms(clock);
        // add to address to from's followees
        if(!table::contains(&global.relationships, from)) {
            let relationship = RelationShip {
                followers: table::new(ctx),
                followees: table::new(ctx),
            };
            table::add(&mut global.relationships, from, relationship);
        };
        let relationship_from = table::borrow_mut(&mut global.relationships, from);
        assert!(!table::contains(&relationship_from.followees, to), EALREADY_FOLLOWED);
        table::add(&mut relationship_from.followees, to, now);
        // add from address to to's followers
        if(!table::contains(&global.relationships, to)) {
            let relationship = RelationShip {
                followers: table::new(ctx),
                followees: table::new(ctx),
            };
            table::add(&mut global.relationships, to, relationship);
        };
        let relationship_to = table::borrow_mut(&mut global.relationships, to);
        table::add(&mut relationship_to.followers, from, now);
        // event
        event::emit(FollowEvent {
            from,
            to,
            timestamp_ms: now,
        });
    }

    public entry fun unfollow(
        global: &mut Global,
        to: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let from = sender(ctx);
        // remove to address from from's followees
        assert!(table::contains(&global.relationships, from), ENO_RELATIONSHIP_FOUND_FOR_FROM);
        let relationship_from = table::borrow_mut(&mut global.relationships, from);
        assert!(table::contains(&relationship_from.followees, to), ENOT_FOLLOWED);
        table::remove(&mut relationship_from.followees, to);
        // remove from address from to's followers
        assert!(table::contains(&global.relationships, to), ENO_RELATIONSHIP_FOUND_FOR_TO);
        let relationship_to = table::borrow_mut(&mut global.relationships, to);
        assert!(table::contains(&relationship_to.followers, from), ENOT_FOLLOWED);
        table::remove(&mut relationship_to.followers, from);
        // emit event
        event::emit(UnfollowEvent {
            from,
            to,
            timestamp_ms: timestamp_ms(clock),
        });
    }

    public fun check_relationship(
        global: &Global,
        from: address,
        to_vec: vector<address>,
        _ctx: &mut TxContext,
    ) {
        let len = vector::length(&to_vec);
        let i = 0;
        let to_relationships = vector::empty();
        if(!table::contains(&global.relationships, from)) {
            while(i < len) {
                let to = *vector::borrow(&to_vec, i);
                let relation_event = RelationEvent {
                    to,
                    is_followee: false,
                    is_follower: false,
                };
                vector::push_back(&mut to_relationships, relation_event);
                i = i + 1;
            };
        } else {
            let relationship = table::borrow(&global.relationships, from);
            while(i < len) {
                let to = *vector::borrow(&to_vec, i);
                let relation_event = RelationEvent {
                    to,
                    is_followee: table::contains(&relationship.followees, to),
                    is_follower: table::contains(&relationship.followers, to),
                };
                vector::push_back(&mut to_relationships, relation_event);
                i = i + 1;
            };
        };
        event::emit(CheckRelationshipEvent {
            from,
            to_relationships,
        })
    }
}
