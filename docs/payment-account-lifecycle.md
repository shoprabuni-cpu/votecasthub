# Payment account lifecycle

Apply `20261016100000_payment_account_lifecycle.sql` before deploying the new application.

Owners/admins can update a current account or deactivate it. The inactive account remains
visible, with a button to create a replacement. Creation verifies that the previous
Paystack subaccount is inactive. The organization primary key permits one current
account; masked snapshots and old payment subaccount references remain preserved.

Account operations and checkout inserts lock the same organization row. Pending/created
Paystack payments prevent account changes until reconciled. Do not mark an attempt failed
merely because it is old: previously issued provider checkout URLs may still be usable.

## Interrupted requests

Ambiguous Paystack responses retain the reservation in `payment_account_operations`.
New checkouts and account changes remain blocked. There is no automatic lock expiry.

Support recovery:

1. Inspect the operation token and saved account. For creation, locate the exact Paystack
   subaccount with matching `account_operation` metadata and confirm the old account is
   inactive. Never repeat an uncertain creation request.
2. For updates/deactivation, fetch the saved subaccount from Paystack and verify the
   intended change completed. Deactivation requires `active: false`.
3. Synchronize the current account with confirmed provider details. Require GHS, 10%,
   and Paystack active/verified before enabling checkout. Historical snapshots are automatic.
4. Remove only the matching operation token after both sides agree. Keep the creation
   reservation in `paystack_account_requests` following successful creation.

Keep the lock if the provider outcome is uncertain. Never manually reactivate a replaced
subaccount in Paystack; external changes bypass the application's single-account workflow.

## Verification

Run `node scripts/test-payment-database.mjs` for lifecycle, pending payment, history,
checkout and permission regressions. Live Paystack mutations need a separate test-mode
integration exercise; local database tests do not exercise Paystack's network API.
