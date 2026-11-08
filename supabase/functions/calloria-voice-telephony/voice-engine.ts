export const VOICE_LANGUAGES = ['en','ha','yo','ig','pcm'] as const;
export const VOICE_DEPARTMENTS = [
  { digit:'1', department:'RuffNeck Products and Platform Support', intent:'platform_support', skill:'platform_support', priority:'normal' },
  { digit:'2', department:'Sales and Service Enquiries', intent:'sales_enquiry', skill:'sales', priority:'normal' },
  { digit:'3', department:'Complaints and Service Recovery', intent:'complaint', skill:'complaints', priority:'high' },
  { digit:'4', department:'Personal Development and Wellbeing Information', intent:'personal_guidance', skill:'personal_guidance', priority:'normal' },
  { digit:'5', department:'General Customer Care', intent:'general_support', skill:'general_customer_care', priority:'normal' },
  { digit:'6', department:'Safeguarding and Trained Human Support', intent:'safeguarding', skill:'safeguarding', priority:'urgent' }
] as const;

export function cleanVoiceText(value: unknown, maximum = 500): string {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,maximum);
}
export function validNigeriaE164(value: unknown): string {
  const phone=String(value ?? '').replace(/[\s().-]/g,'');
  if (!/^\+234[0-9]{7,11}$/.test(phone)) throw new Error('Use a valid Nigerian phone number in +234 format.');
  return phone;
}
export function validE164Nigeria(value: unknown): string {
  const phone=String(value ?? '').replace(/[\s().-]/g,'');
  if (!/^\+234[789]\d{9}$/.test(phone)) throw new Error('Use a valid Nigerian mobile number in +234 format.');
  return phone;
}
export function maskVoiceNumber(value: string): string {
  const digits=value.replace(/\D/g,'');
  if (digits.length < 7) return '••••••';
  return `+${digits.slice(0,3)} •••• ${digits.slice(-4)}`;
}
export function voiceLanguage(value: unknown): typeof VOICE_LANGUAGES[number] | null {
  const digit=String(value ?? '').trim();
  return ({'1':'en','2':'ha','3':'yo','4':'ig','5':'pcm'} as Record<string,typeof VOICE_LANGUAGES[number]>)[digit] || null;
}
export function voiceDepartment(value: unknown) {
  return VOICE_DEPARTMENTS.find(row=>row.digit===String(value ?? '').trim()) || null;
}
export function xmlEscape(value: unknown): string {
  return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
export function buildLanguageMenu(actionUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="1" timeout="8" action="${xmlEscape(actionUrl)}" method="POST"><Say>Welcome to RuffNeck Entertainment customer care. For English, press 1. For Hausa, press 2. For Yoruba, press 3. For Igbo, press 4. For Nigerian Pidgin, press 5.</Say></Gather><Say>We did not receive a selection. Please call again or use our online support channels. Goodbye.</Say><Hangup/></Response>`;
}
export function buildDepartmentMenu(language: string, actionUrl: string): string {
  const lines: Record<string,string>={
    en:'For RuffNeck product and platform support, press 1. For sales and service enquiries, press 2. For complaints, press 3. For personal development and wellbeing information, press 4. For general customer care, press 5. For safeguarding support, press 6.',
    ha:'Don samun taimakon dandamali, danna 1. Don tallace-tallace da bayanan ayyuka, danna 2. Don korafi, danna 3. Don ci gaban kai da jin daɗi, danna 4. Don kula da abokan ciniki gabaɗaya, danna 5. Don taimakon kariya, danna 6.',
    yo:'Fun iranlowo lori awon iru ẹrọ RuffNeck, te 1. Fun tita ati alaye iṣẹ, te 2. Fun ẹdun ọkan, te 3. Fun idagbasoke ara ẹni ati ilera gbogbogbo, te 4. Fun itọju alabara gbogbogbo, te 5. Fun iranwọ aabo, te 6.',
    ig:'Maka enyemaka ngwaahịa na ikpo okwu RuffNeck, pịa 1. Maka ire na ajụjụ ọrụ, pịa 2. Maka mkpesa, pịa 3. Maka mmepe onwe na ọdịmma, pịa 4. Maka nlekọta ndị ahịa, pịa 5. Maka enyemaka nchekwa, pịa 6.',
    pcm:'For RuffNeck product and platform support, press 1. For sales and service questions, press 2. For complaints, press 3. For personal growth and wellbeing information, press 4. For general customer care, press 5. For safeguarding support, press 6.'
  };
  const prompt=lines[language] || lines.en;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="1" timeout="8" action="${xmlEscape(actionUrl)}" method="POST"><Say>${xmlEscape(prompt)}</Say></Gather><Say>We did not receive a selection. Please try again later or use our online support channels. Goodbye.</Say><Hangup/></Response>`;
}
export function buildDialResponse(number: string, actionUrl: string, language: string): string {
  if (!number) return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Our live team is not available on this line at the moment. Please use the RuffNeck website support service or try again later. Goodbye.</Say><Hangup/></Response>`;
  const safeNumber=`<Number>${xmlEscape(number)}</Number>`;
  const message=language==='ha'?'Don Allah ku jira, muna haɗa ku da ma’aikaci.':language==='yo'?'Ẹ jọwọ duro, a n so yin pọ mọ aṣoju wa.':language==='ig'?'Biko chere, anyị na-ejikọta gị na onye ọrụ anyị.':'Please hold while we connect you to a customer care representative.';
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${xmlEscape(message)}</Say><Dial timeout="22" action="${xmlEscape(actionUrl)}" method="POST">${safeNumber}</Dial><Say>We could not connect your call. Please use our online support channels. Goodbye.</Say><Hangup/></Response>`;
}
export function normalizeCallStatus(value: unknown): string {
  const status=String(value ?? '').toLowerCase();
  if (['queued','ringing','in-progress','completed','busy','no-answer','failed','canceled'].includes(status)) return status;
  return 'failed';
}
export function validateCallbackEvidence(value: unknown): string {
  const text=cleanVoiceText(value,100);
  if (!/^[A-Za-z0-9][A-Za-z0-9:_./-]{5,99}$/.test(text)) throw new Error('Enter a traceable case, CRM consent or interaction evidence reference (6–100 characters).');
  return text;
}
