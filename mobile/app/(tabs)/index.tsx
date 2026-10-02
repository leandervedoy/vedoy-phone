import React,{useCallback,useState} from 'react';
import {ScrollView,Text,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button,Card,Label} from '../../components/ui';
import {theme as t} from '../../theme';
import {api} from '../../lib/api';
type Line={id:string;phone_number:string;country_code:string;capabilities:{voice:boolean;sms:boolean;mms:boolean};status:string};
export default function Home(){
 const [lines,setLines]=useState<Line[]>([]);const [loading,setLoading]=useState(true);
 const refresh=useCallback(()=>api<{numbers:Line[]}>('/v1/numbers/mine').then(x=>setLines(x.numbers)).catch(()=>{}).finally(()=>setLoading(false)),[]);
 useFocusEffect(useCallback(()=>{refresh()},[refresh]));const active=lines.filter(l=>l.status==='active');
 return <SafeAreaView style={{flex:1,backgroundColor:t.color.bg}}><ScrollView contentContainerStyle={{padding:22,gap:18}}>
 <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><View><Text style={{color:t.color.text,fontSize:24,fontWeight:'900',letterSpacing:2}}>VEDOY<Text style={{color:t.color.green}}> ↗</Text></Text><Text style={{color:t.color.muted,marginTop:4}}>Din globale arbeidslinje</Text></View><Ionicons name="radio" size={22} color={t.color.green}/></View>
 <Card style={{padding:22,backgroundColor:'#151D18',gap:10}}><Label>{loading?'SJEKKER LINJER':active.length?`AKTIVE LINJER · ${active.length}`:'DIN LINJE'}</Label>{active.length?<><Text style={{color:t.color.text,fontSize:24,fontWeight:'800'}}>{active[0].phone_number}</Text>{active.length>1?<Text style={{color:t.color.muted,fontSize:12}}>og {active.length-1} flere · administrer i Profil</Text>:null}<Text style={{color:t.color.green,fontSize:13,fontWeight:'700'}}>SMS {active[0].capabilities.sms?'✓':'—'} · Tale {active[0].capabilities.voice?'✓':'—'}</Text><View style={{flexDirection:'row',gap:9,marginTop:6}}><View style={{flex:1}}><Button title="Ring ut" onPress={()=>router.push('/(tabs)/calls')}/></View><View style={{flex:1}}><Button title="Ny SMS" secondary onPress={()=>router.push('/(tabs)/messages')}/></View></View></>:<><Text style={{color:t.color.text,fontSize:25,fontWeight:'800'}}>Koble til nummer</Text><Text style={{color:t.color.muted,lineHeight:21}}>Velg et virtuelt nummer for å aktivere samtaler og SMS.</Text><Button title="Utforsk nummerbutikken  ↗" onPress={()=>router.push('/(tabs)/numbers')}/></>}</Card>
 <Label>SNARVEIER</Label><View style={{flexDirection:'row',gap:10}}><Card style={{flex:1,gap:8}}><Ionicons name="call" size={20} color={t.color.green}/><Text onPress={()=>router.push('/(tabs)/calls')} style={{color:t.color.text,fontWeight:'800'}}>Samtaler</Text><Text style={{color:t.color.muted,fontSize:12}}>Ring og se historikk</Text></Card><Card style={{flex:1,gap:8}}><Ionicons name="chatbubble-ellipses" size={20} color={t.color.green}/><Text onPress={()=>router.push('/(tabs)/messages')} style={{color:t.color.text,fontWeight:'800'}}>Meldinger</Text><Text style={{color:t.color.muted,fontSize:12}}>SMS-tråder og status</Text></Card><Card style={{flex:1,gap:8}}><Ionicons name="apps-outline" size={20} color={t.color.green}/><Text onPress={()=>router.push('/(tabs)/apps')} style={{color:t.color.text,fontWeight:'800'}}>Apper</Text><Text style={{color:t.color.muted,fontSize:12}}>Dine mobilverktøy</Text></Card></View>
 <Card><Label>ETTER HVERANDRE</Label><Text style={{color:t.color.text,fontSize:17,fontWeight:'800',marginTop:9}}>Én arbeidsflate. Hele verden.</Text><Text style={{color:t.color.muted,lineHeight:21,marginTop:7}}>Nummer, funksjoner, månedskostnad og dokumentkrav vises før leie. Internasjonale rutetillatelser styres separat.</Text></Card>
 </ScrollView></SafeAreaView>
}
