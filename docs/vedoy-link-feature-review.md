# Vedoy Link — prioriterte funksjoner etter gjennomgang av åpne Twilio-apper

Dato: 7. november 2026. Dette er en produktanbefaling og ingen påstand om at funksjonene finnes i Vedoy Link.

## GitHub-referanser
- [Twilio Voice React Native Reference App](https://github.com/twilio/twilio-voice-react-native-app): native VoIP, innkommende anrop, samtalevisning, autentisering.
- [Titan Dialer](https://github.com/AgentoxAI/AgentoxAI-Titan): innboks, kontakthåndtering, anropslogg, tapte anrop, forbruksoversikt og PWA.
- [SMSHub](https://github.com/profullstack/smshub): samordnet SMS-innboks og flerleverandør-arkitektur (Twilio/Telnyx).
- [TwilioHub OSS](https://github.com/Raktim94/nodedrdial): sanntidsinnboks, samtalenotater, team, sentralbord, analyse og admin.
- [Chatwoot](https://github.com/chatwoot/chatwoot): delt kundeserviceinnboks og tildeling til ansatte.

Inspirasjon er ikke lisens til å kopiere kode. Verifiser lisens, oppdateringsgrad og sikkerhet før gjenbruk.

## P0 — før privat betalansering
1. **Velg nummer**: fem sanntidstilgjengelige numre fra leverandøren per valgt land/nummertype; gjeldende pris, tale/SMS-egenskaper og regulatoriske krav.
2. **Trygg aktivering**: bekreftet identitet der lov eller leverandør krever det, godkjent regulatorisk bundle/adresse og bekreftet betaling før serverbasert kjøp. Vis estimert fast månedspris og brukskostnader før betaling.
3. **Samtaler**: utgående/innkommende anrop, tydelig aktivt nummer, mikrofon av/på, legg på, anropslogg og tapte-anrop-varsel.
4. **Meldinger**: toveis SMS, samtaletråder, leveringsstatuser og tydelig avsendernummer.
5. **Kontakter**: kontakter, favoritter, blokkering og valg av nummer per samtale.
6. **Forbruksinnsyn**: abonnement, gjeldende kostnader, kvitteringer, kansellering og sikker sperre mot overforbruk.
7. **Sikkerhet**: kontobekreftelse, sikker sesjon, rater og forbrukskvoter, serverkontrollert kjøp, signaturverifiserte webhooks, ingen Twilio-nøkler i klientkode.
8. **Norsk først**: tydelig støtte- og prisinformasjon, personvern, datalagring og forskjellen mellom app-meldinger og offentlig telefoni.

## P1 — Vedoy Link etter grunnfunksjonene
- Samle Sent-meldinger og telefon/SMS i en app, men **ikke kall vanlig SMS/PSTN ende-til-ende-kryptert**.
- Flere numre og samtaleprofiler (privat, jobb, handel), separat kontakt- og varslingsprofil.
- Talepost og valgfri transkripsjon med databehandleravtale og lagringsvalg.
- Spamfilter, blokkering, tydelig fremvisning av ringe-ID.
- Støtte for tilgjengelighet: store trykkflater, skjermleser og varsler ved nettbrudd.

## P2 — bedriftsversjon
- Teaminnboks, eierskap/tildeling, rollebasert tilgang og auditlogg.
- IVR/sentralbord, åpningstider, viderekobling, kø og varm overføring.
- CRM-integrasjon og API/webhooks, samtalerapport og kostnadsoversikt.
- Avtalt opptak, oppbevaring og samtykke; standard er opptak av.

## Sandbox som implementeres nå
- Ren nettleserdemo i `public/sandbox.html` og `public/sandbox-catalog.mjs`.
- Fem **fiktive** numre per land/type: `TEST-NO-LOCAL-0001` ... `0005`.
- Valg, prisoversikt og kjøpsbekreftelse. 10 **test-Credits**, 0 kroner.
- Simulert BankID-godkjenning. Ekte BankID skal ikke testes med denne løsningen.
- Nummeret lagres kun lokalt i nettleseren; ingen Twilio-kjøp, ingen realfakturering og ingen writes til Supabase/Neon.
- Et testnummer er ikke et tildelt telefonnummer.

## Produksjonsarkitektur (ikke implementert her)
Vedoy Phone-repositoriet dokumenterer Neon Auth og Neon PostgreSQL som sin nåværende appbackend. Vedoy har samtidig egne kommunikasjons- og utviklertabeller i Supabase. Velg én kilde for kundekonto, nummerrettigheter og betaling før produksjonsintegrasjon; ikke skriv samme kundekjøp til to databaser uten en eksplisitt synkroniseringsmodell.

Serveren skal: identifisere bruker, spørre Twilio/Telnyx om sanntidstilgjengelighet og pris, reservere/validere valgt nummer med kort TTL eller ny tilgjengelighetssjekk, validere regulatoriske dokumenter, bekrefte betaling, gjennomføre idempotent provisioning, registrere rettigheten i databasen og avstemme webhooks. Feil og refusjon må håndteres før kunden ser nummeret som aktivt.

**Ikke vis fiktive numre som sanntidslager fra Twilio; og ikke la lokale Credits være kilde for reell økonomi.**
