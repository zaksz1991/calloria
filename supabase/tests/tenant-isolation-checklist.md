# Live tenant isolation acceptance checklist

This checklist is deliberately not marked as passed by unit tests. Run it against the configured Supabase project using two separately registered accounts and two separate organisation tenants.

| Test | Expected result | Verified |
|---|---|---|
| Unauthenticated access to tenant tables | Denied | [ ] |
| Account A selects its tenant | Allowed | [ ] |
| Account A selects tenant B by known UUID | Returns no rows / denied | [ ] |
| Account A reads tenant B member profiles | Returns no rows / denied | [ ] |
| Account A reads tenant B invitation/policy/audit data | Returns no rows / denied | [ ] |
| Agent calls invite RPC | Denied | [ ] |
| Agent calls policy RPC | Denied | [ ] |
| Manager calls member-status RPC | Denied | [ ] |
| Owner tries to invite role `owner` | Denied | [ ] |
| Wrong email accepts an invitation | Denied | [ ] |
| Unconfirmed invited email accepts invitation | Denied | [ ] |
| Correct confirmed email accepts pending invitation | Allowed | [ ] |
| Expired invitation acceptance | Denied and marked expired | [ ] |
| Suspended membership reads tenant data | Denied | [ ] |
| Owner member status is changed to suspended | Denied | [ ] |
| Policy mutation writes an audit record | Allowed for owner/admin only | [ ] |
| Service-role/secret key appears in deployed client assets | Must not appear | [ ] |

Record the Supabase project reference, test date, tester, browser version and evidence for every failure or pass before enabling production organisation data.
