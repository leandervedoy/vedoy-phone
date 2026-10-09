import React,{useEffect,useState} from 'react';
import { ActivityIndicator,View } from 'react-native';
import { Redirect } from 'expo-router';
import { authClient } from '../lib/auth';
import { theme } from '../theme';
export default function Index(){const [ready,setReady]=useState(false);const [signedIn,setSignedIn]=useState(false);useEffect(()=>{authClient.getSession().then(({data})=>{setSignedIn(!!data?.session);setReady(true)}).catch(()=>setReady(true))},[]);if(!ready)return <View style={{flex:1,backgroundColor:theme.color.bg,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={theme.color.green}/></View>;return <Redirect href={signedIn?'/(tabs)':'/auth'}/>}
