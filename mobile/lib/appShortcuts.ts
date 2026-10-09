export type AppShortcut={id:string;name:string;description:string;kind:'Native app + web'|'Mobilnettsted'|'Desktop-funksjon';icon:string;accent:string;openUrl:string;iosStore?:string;androidStore?:string;alternateUrl?:string;featured?:boolean;cta?:string};
/** External mobile destinations. These are shortcuts only; they do not link accounts or share credentials. */
export const appShortcuts:AppShortcut[]=[
 {id:'autocalls',name:'Autocalls AI',description:'Start AI-drevne telefonsamtaler, agentflyter og kampanjer fra mobilen.',kind:'Mobilnettsted',icon:'radio-outline',accent:'#A78BFA',openUrl:'https://app.autocalls.ai/',featured:true,cta:'Åpne Autocalls'},
 {id:'wix',name:'Wix',description:'Administrer nettsted, innboks og virksomhet',kind:'Native app + web',icon:'globe-outline',accent:'#4EA1FF',openUrl:'https://manage.wix.com/',iosStore:'https://apps.apple.com/no/app/wix-website-builder/id1545924344',androidStore:'https://play.google.com/store/apps/details?id=com.wix.admin'},
 {id:'chatgpt',name:'ChatGPT',description:'OpenAI-appen for samtaler og assistanse',kind:'Native app + web',icon:'chatbubbles-outline',accent:'#72D7AD',openUrl:'https://chatgpt.com/',iosStore:'https://apps.apple.com/no/app/chatgpt/id6448311069',androidStore:'https://play.google.com/store/apps/details?id=com.openai.chatgpt'},
];
