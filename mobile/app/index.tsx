import React,{useEffect,useState} from 'react';
import { ActivityIndicator,View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { theme } from '../theme';
export default function Index(){const [ready,setReady]=useState(false);const [signedIn,setSignedIn]=useState(false);useEffect(()=>{if(!supabase){setReady(true);return}supabase.auth.getSession().then(({data})=>{setSignedIn(!!data.session);setReady(true)}).catch(()=>setReady(true))},[]);if(!ready)return <View style={{flex:1,backgroundColor:theme.color.bg,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={theme.color.green}/></View>;return <Redirect href={signedIn?'/(tabs)':'/auth'}/>}
