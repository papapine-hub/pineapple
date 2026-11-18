# Security Specification — 파인애플작업실 Firestore Rules

## 1. Data Invariants
1. Every document under `/users/{userId}` and its subcollections (`settings`, `bots`, `goals`, `calendarEvents`, `presets`) strictly belongs to `userId` (`request.auth.uid == userId`).
2. Every subcollection document requires `ownerId == request.auth.uid`, an `id` matching the document path ID (matching `^[a-zA-Z0-9_\-]+$`), and a valid parent `/users/{userId}` document (`exists()` + `uid == request.auth.uid`) for single-document operations.
3. No unauthenticated read or write is permitted anywhere, and `/users` collection listing is denied (`allow list: if false`).
4. Subcollection `allow list` rules evaluate `resource.data.ownerId == request.auth.uid` directly without `get()`/`exists()` calls.
5. Server timestamps (`syncedAt == request.time`, `updatedAt == request.time` on `UserProfile`) are enforced on every write; `ownerId`, `id`, and `createdAt` remain immutable on update.
6. Unexpected shadow fields and oversized payloads are rejected via `keys().hasAll(...)`, `keys().hasOnly(...)`, `affectedKeys().hasOnly(...)`, and explicit `.size()` limits on all strings and lists.

## 2. Dirty Dozen Adversarial Payloads
1. **Unauthenticated Read**: `GET /users/uidA/bots/bot_1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Cross-User Read**: `GET /users/uidA/bots/bot_1` authenticated as `uidB` -> `PERMISSION_DENIED`.
3. **Cross-User Profile List**: `LIST /users` authenticated as `uidA` -> `PERMISSION_DENIED`.
4. **Owner Spoofing on Create**: `CREATE /users/uidA/bots/bot_1` as `uidA` with `ownerId: "uidB"` -> `PERMISSION_DENIED`.
5. **Path ID Mismatch**: `CREATE /users/uidA/bots/bot_1` with `id: "bot_2"` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: `CREATE /users/uidA/bots/invalid id with spaces!` -> `PERMISSION_DENIED`.
7. **Shadow Field Injection on Create**: `CREATE /users/uidA` with extra `isAdmin: true` -> `PERMISSION_DENIED`.
8. **Shadow Field Injection on Update**: `UPDATE /users/uidA/goals/goal_1` with extra `role: "admin"` -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: `CREATE /users/uidA/goals/goal_1` with forged `syncedAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
10. **Immutable Field Mutation**: `UPDATE /users/uidA/bots/bot_1` changing `ownerId` -> `PERMISSION_DENIED`.
11. **Invalid Enum Status**: `CREATE /users/uidA/bots/bot_1` with `status: "hacked"` -> `PERMISSION_DENIED`.
12. **Oversized String Exhaustion**: `CREATE /users/uidA/goals/goal_1` with 5,000-char `title` -> `PERMISSION_DENIED`.
