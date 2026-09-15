# Hardware Integration Findings

Research date: 2026-09-13

The supplied AliExpress short link resolves to AliExpress item `1005010576316625`, but the listing is protected by a verification page, so its product details could not be read directly.

A matching manufacturer/catalog page identifies the product family as a **Voijump AI Voice Recorder / AI Note Taker**, with 64 GB storage, WAV format, smartphone compatibility, and a USB hardware interface. The product description claims app control, encrypted cloud sync/share, one-click export, and local storage. The public product page does not document a public developer API or a third-party SDK.

The supplied Google Play package `com.record.airec.google` is **AIREC - Voice Transcription**, published by AIREC LLC. Its public description explicitly says that it connects to smart recorders through **Bluetooth** and transfers voice files from the recorder to the phone. It provides transcription, AI summaries, mind maps, real-time transcription, and simultaneous interpretation. Google Play reports that the app may collect personal info, messages, and audio, and declares no third-party data sharing.

Practical implication: FlowType may be able to integrate with the recorder through Bluetooth if the device exposes a documented or discoverable BLE/GATT protocol. A simpler and more reliable first integration could be importing the recorder’s transferred WAV files into FlowType, if AIREC or Android exposes them through a share/export path. Direct Bluetooth control/transfer cannot be promised without the exact device model, pairing behavior, BLE services/characteristics, or vendor documentation.

Sources reviewed:
- User-provided AliExpress link: https://a.aliexpress.com/_c38yDmTL
- Resolved AliExpress item: https://www.aliexpress.com/item/1005010576316625.html
- Voijump catalog: https://voijump.com/collections/all
- Matching product page: https://digitnow.com/products/ai-voice-recorder-ai-note-taker-64gb-with-app-control-ai-technology-transcribe-summarize-free-121-languages-audio-recorder-device-for-meetings-calls-ultra-slim-display-magnetic-case-grey
- AIREC Google Play listing: https://play.google.com/store/apps/details?id=com.record.airec.google&hl=en_US

Additional verified findings:

The Google Play listing is AIREC - Voice Transcription by AIREC LLC. It explicitly states that the app connects to smart recorders through Bluetooth and transfers voice files from the recorder to the phone.

A public AIREC Smart APP Recorder manual describes the Q70 recorder family. It instructs users to install the AIREC app, turn the device on, open AIREC, tap `[ + unconnected ]`, and choose connect device. The manual also says to use the original data cable when reading data from the device and warns users to save recordings before connecting to a computer. This suggests two practical paths: Bluetooth pairing/file transfer through the recorder’s proprietary protocol, or USB/local-file import.

No public BLE service UUIDs, GATT characteristics, SDK, or vendor API were found in the reviewed public sources. Direct FlowType-to-device Bluetooth support therefore requires the physical device and protocol inspection, or cooperation from the vendor. A first-party-safe MVP should begin with an Import Recording flow that accepts WAV files transferred from the recorder, then add direct Bluetooth only after a real device is available for testing.

Additional source:
- AIREC Smart APP Recorder User Manual: https://device.report/manual/15072666
