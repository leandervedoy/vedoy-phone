# Country availability and service permissions

The app avoids static carrier claims. `GET /v1/numbers/countries` lists ISO countries and merges in the account-scoped Twilio AvailablePhoneNumbers catalog. This lets the UI distinguish countries with a searchable Twilio number from all destinations which may be eligible for an outbound route. Each item includes separate `outboundVoicePolicyEnabled` and `outboundSmsPolicyEnabled` flags derived from server allowlists, plus an explicit `mobileData: false`. Configure `VOICE_ALLOWED_COUNTRIES` and `SMS_ALLOWED_COUNTRIES` before enabling destinations. Twilio geo permissions and route-specific checks remain separate gates.

`GET /v1/numbers/available?country=NO&type=local` reads current inventory; each returned number has live `voice`, `sms`, `mms`, and address-requirement metadata plus Twilio's current monthly price when available. `GET /v1/numbers/countries/:code/capabilities` provides one live sample per searchable number class, while `GET /v1/numbers/countries/:code/pricing` gives recurring price estimates. The UI requires the latest monthly amount and currency to be confirmed again at purchase time. Twilio usage charges are separate and Twilio bills its connected account directly; Vedoy does not currently bill end users.

| Item | Meaning | Limit |
| --- | --- | --- |
| Country and class (`local`, `mobile`, `tollFree`) | Twilio currently exposes that search class for this account | Does not promise a matching number remains in inventory |
| SMS | The specific number reports SMS capability | Delivery to every destination, sender registration, and regulatory approval are not implied |
| Voice | The number reports Voice capability | Every outbound international route, emergency service coverage, and destination price are not implied |
| MMS | The number reports MMS capability | Delivery on every destination carrier is not guaranteed |
| Address requirement | Twilio search currently reports `none`, `any`, `local`, or `foreign` | Does not replace the complete regulatory checklist |
| International calls/SMS | Must pass both the Vedoy server allowlist and Twilio destination geo permissions and tariffs | The number's country alone does not permit international calls or messaging |
| Mobile data | Not included | This service is VoIP/SMS, not a mobile carrier plan or SIM/eSIM data service |

The country picker includes all ISO destinations, not just countries where this Twilio account can buy a number. It flags number-search availability separately from outgoing calling/SMS. For every number class, the app shows a live sample; the chosen inventory result is the authority for capabilities and requirements. The live catalog describes number capabilities; international route availability and charges require their own checks before use.

Twilio says country regulations may require identity and address documents, exact name/address matching, local address, regulatory bundles and number mapping. Requirements differ by country and number type and change. Review [Twilio's regulatory FAQ](https://www.twilio.com/docs/phone-numbers/regulatory/faq) and its current country-specific requirement before offering any number.

This implementation blocks numbers whose search result reports an address requirement unless KYC status is approved and a regulatory address SID is configured. KYC approval is a manual review state. The administrator endpoint also requires Twilio compliance to be marked complete; document upload alone does not satisfy Twilio or local law. Implement and verify the country-specific Regulatory Compliance bundle submission/mapping process before launch.

References: [Twilio country resource](https://www.twilio.com/docs/phone-numbers/api/availablephonenumber-resource), [available number mobile resource](https://www.twilio.com/docs/phone-numbers/api/availablephonenumber-mobile-resource), [incoming number capabilities](https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource).
