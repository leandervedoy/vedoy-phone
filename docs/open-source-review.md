# Open-source review and feature coverage

## Reference reviewed

The implementation uses the official [Twilio Voice React Native SDK](https://github.com/twilio/twilio-voice-react-native) and its [React Native reference app](https://github.com/twilio/twilio-voice-react-native-app) as architecture references. It follows their native VoIP SDK and token-vending model; the Vedoy application code and styling are original.

## Covered flows

- Sign in, receive an access token from the server, and register the device for incoming VoIP calls.
- Make outbound calls with an owned caller ID; receive calls anywhere in the authenticated app; accept, reject, mute and end calls.
- View call status and recent call history.
- Send/receive SMS threads from any owned SMS-capable number; view message status and honor opt-out keywords.
- Search number inventory by country and number class, compare per-number capabilities/address requirements and account pricing, confirm recurring cost, provision multiple lines up to the account limit, and release a line.
- Upload identity/address documents privately and gate regulated-number provisioning on an approved, compliance-complete review.
- See Twilio number availability, outgoing Vedoy allowlists, sample Voice/SMS/MMS support and the explicit absence of mobile-data service.
- Launch the requested partner tools from a mobile shortcut screen, with native store links where verified and web dashboards otherwise.

## Launch dependencies

Incoming calls still require valid APNs VoIP and Firebase push credentials and physical-device verification. Destination country allowlists default to empty. Twilio's account-specific destination geo permissions and regulatory bundles must also be configured. VoIP numbers do not include cellular data. Number charges go directly to the connected Twilio account; this project has no customer-facing payments or invoicing yet.
