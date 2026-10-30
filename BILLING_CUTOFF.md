# Billing cutoff

The `billingCutoff` Cloud Function detaches billing from the project when
spending reaches the budget threshold, stopping all paid GCP services.

## How it works

A Cloud Billing budget sends a Pub/Sub message to the `billing-alerts` topic
whenever spend crosses an alert threshold. The function decodes the message,
compares `costAmount` to `budgetAmount`, and calls the Cloud Billing API to set
`billingAccountName` to an empty string on the project if `costAmount >=
budgetAmount`. The call is idempotent — re-triggering after billing is already
detached is harmless.

To restore service, re-attach the billing account in the GCP Console under
**Billing → My projects**.

## One-time setup (per environment)

### 1. Create the Pub/Sub topic

```
gcloud pubsub topics create billing-alerts --project=<PROJECT_ID>
```

### 2. Create the Cloud Billing budget

In the GCP Console → Billing → Budgets & alerts:

- Set the budget amount to **$5**
- Under **Manage notifications**, link the `billing-alerts` Pub/Sub topic
- Set an alert threshold at **100 %** of budget

### 3. Grant the function permission to detach billing

The function's service account needs `roles/billing.projectManager` on the
billing account so it can update billing info:

```
gcloud billing accounts add-iam-policy-binding <BILLING_ACCOUNT_ID> \
  --member="serviceAccount:<PROJECT_ID>@appspot.gserviceaccount.com" \
  --role="roles/billing.projectManager"
```

Replace `<BILLING_ACCOUNT_ID>` and `<PROJECT_ID>` with your values.
Do **not** commit actual billing account IDs to the repository.

### 4. Deploy the function

```
npm run deploy.functions
```

## Pub/Sub message format

Cloud Billing budget alerts send a JSON payload (base64-encoded) of the form:

```json
{
  "costAmount": 3.42,
  "budgetAmount": 5.0,
  "currencyCode": "USD",
  "budgetDisplayName": "peachcourt-$5-cap"
}
```

The function only reads `costAmount` and `budgetAmount`.
