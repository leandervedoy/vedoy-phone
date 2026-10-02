import React,{useCallback,useState} from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from 'expo-router';
import {PageTitle,Card,Field,Button,Label} from '../../components/ui';
import {theme as t} from '../../theme';
import {api} from '../../lib/api';
import {useVoice} from '../../components/VoiceProvider';
type Log={call_sid:string;status:string;from_number:string;to_number:string;duration_seconds:number|null};
type Line={id:string;phone_number:string;capabilities:{voice:boolean;sms:boolean;mms:boolean};status:string};
export default function Calls(){
 const [number,setNumber]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[logs,setLogs]=useState<Log[]>([]),[lines,setLines]=useState<Line[]>([]),[selectedLine,setSelectedLine]=useState('');
 const voice=useVoice();
 useFocusEffect(useCallback(()=>{api<{calls:Log[]}>('/v1/voice/history').then(x=>setLogs(x.calls)).catch(()=>{});api<{numbers:Line[]}>('/v1/numbers/mine').then(x=>{const capable=x.numbers.filter(n=>n.capabilities.voice&&n.status==='active');setLines(capable);setSelectedLine(current=>capable.some(n=>n.phone_number===current)?current:capable[0]?.phone_number??'')}).catch(()=>{})},[]));
 async function dial(){setNotice('');setBusy(true);try{if(!selectedLine)throw Error('Kjøp en taleaktivert linje først.');await voice.dial(number,selectedLine)}catch(e){setNotice(e instanceof Error?e.message:'Kunne ikke starte samtalen.')}finally{setBusy(false)}}
 return <SafeAreaView style={{flex:1,backgroundColor:t.color.bg}}><ScrollView contentContainerStyle={{padding:22,gap:16}}><PageTitle eyebrow="TALE" title="Ring hvor som helst" sub="Demp, avslutt og besvar anrop fra hele appen."/><Card style={{gap:14}}><Label>RING FRA LINJE</Label><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{lines.map(l=><Pressable key={l.id} onPress={()=>setSelectedLine(l.phone_number)}><Text style={{color:selectedLine===l.phone_number?t.color.bg:t.color.text,backgroundColor:selectedLine===l.phone_number?t.color.green:t.color.raised,padding:10,borderRadius:12,overflow:'hidden'}}>{l.phone_number}</Text></Pressable>)}</View><Field value={number} onChangeText={setNumber} placeholder="+47 123 45 678" keyboardType="phone-pad"/><Button title="Start samtale  ↗" onPress={dial} loading={busy} disabled={!selectedLine||!/^[+]\d{6,14}$/.test(number.replace(/\s/g,''))}/></Card>{notice?<Text accessibilityLiveRegion="polite" style={{color:t.color.danger}}>{notice}</Text>:null}{voice.error?<Text style={{color:t.color.danger}}>{voice.error}</Text>:null}<Text style={{color:t.color.muted,fontSize:13,lineHeight:20}}>{voice.token?'Anropslinjen er registrert på denne enheten.':'Klargjøring av anropslinjen venter på innlogging.'}</Text><Label>SISTE SAMTALER</Label>{logs.map(x=><Card key={x.call_sid}><Text style={{color:t.color.text,fontWeight:'700'}}>{x.from_number} → {x.to_number}</Text><Text style={{color:t.color.muted,marginTop:6}}>{x.status} {x.duration_seconds?`· ${x.duration_seconds}s`:''}</Text></Card>)}{logs.length===0?<Card><Text style={{color:t.color.muted}}>Samtalene dine vises her når du ringer.</Text></Card>:null}</ScrollView></SafeAreaView>
}
