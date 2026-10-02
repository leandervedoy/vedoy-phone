import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { VoiceProvider } from '../components/VoiceProvider';
export default function Layout(){return <VoiceProvider><StatusBar style="light"/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:theme.color.bg}}}/></VoiceProvider>}
