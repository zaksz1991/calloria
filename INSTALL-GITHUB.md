# Install CALLORIA v6.37

Apply this patch on top of CALLORIA v6.36.

## Replace one file

Replace the complete contents of:

`build/calloria-cc0-staff-glb-bundle-plugin.mjs`

Use the identically named file in this ZIP. Do not replace `package.json`, `package-lock.json`, Vite configuration, Supabase settings, or any other production file.

The ZIP carries the existing regression suite plus `tests/calloria-v637-native-browser-voice.test.mjs`. The test files are verification assets; the only production replacement is the build plugin.

## Using native browser voice

Once this patch is deployed and the 3D staff runtime loads, the global API is `window.CalloriaStaffVoice`. From the contact/agent response handler, call:

```js
await window.CalloriaStaffVoice.speak({
  assetId: 'female-agent',
  text: agentReply,
  lang: 'en-NG'
});
```

The agent reply handler is not modified by this patch. It must invoke the API for existing contact screens to speak. Call from a user-initiated action where the browser blocks unsolicited audio. See `README.md` for voice selection and stop methods.
