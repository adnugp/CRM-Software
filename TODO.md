# TODO

## Before deploying the new security rules
- [ ] Check that every person who signs in has a `users/{uid}` document with a `role`
      (accounts without one lose access once the rules are live).
- [ ] Check that client projects have `clientId` or `organizationId` set. Clients can no longer
      see projects matched only by company name.
- [ ] Deploy: `firebase deploy --only firestore:rules,storage`

## Known gaps
- [ ] Removing a user deletes their profile but not their Firebase Auth login (needs a Cloud
      Function with the Admin SDK). They can still sign in but see no data.
- [ ] "Email alert" settings are stored only in the browser (localStorage) and nothing sends emails.
- [ ] Turn on TypeScript `strict` mode gradually. Form data types are loose because it's off.
