---
name: Certificate verification
description: Provider constraints and verification rules for lifeguard onboarding.
---

## Rule
Lifeguard signup must be blocked until the selected association confirms the certificate number. Keep provider-specific lookup logic on the API server, not in the mobile client.

**Why:** Certificate IDs are user-provided claims and a client-side confirmation can be bypassed. The American Red Cross exposes a public lookup page but no stable documented API, so its official search result is the current source of truth.

**How to apply:** Add new associations only with their official lookup flow and explicit provider handling. Store the association, type, and verification timestamp; do not expose the certificate number in public profile responses.