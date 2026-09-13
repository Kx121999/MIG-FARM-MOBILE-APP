import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { AccountPage } from '@/components/account/AccountUI';
import { RiskCard } from '@/components/farm/FarmIntelligenceUI';
import { FarmSkeleton } from '@/components/farm/FarmUI';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFarmIntelligence } from '@/hooks/useFarmIntelligence';

export default function RiskCenterScreen(){
  const params=useLocalSearchParams<{farmId?:string}>();
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  const state=useFarmIntelligence(typeof params.farmId==='string'?params.farmId:undefined);
  return <AccountPage title={ar?'مركز المخاطر':'Risk Center'}>
    <View style={styles.note}><ShieldCheck size={20} color={colors.primary}/><Text style={[styles.noteText,{textAlign:isRTL?'right':'left'}]}>{ar?'المخاطر إشارات للمراجعة وليست تشخيصًا مؤكدًا.':'Risks are review signals, not confirmed diagnoses.'}</Text></View>
    {state.loading&&!state.data?<><FarmSkeleton/><FarmSkeleton/></>:null}
    {state.data?.risks.length?<View style={styles.list}>{state.data.risks.map((risk)=><RiskCard key={risk.id} risk={risk}/>)}</View>:state.data?<View style={styles.empty}><Text style={styles.emptyText}>{ar?'لا توجد مخاطر مسجلة الآن.':'No recorded risks right now.'}</Text></View>:null}
  </AccountPage>;
}
const styles=StyleSheet.create({note:{flexDirection:'row',alignItems:'center',gap:spacing.md,backgroundColor:colors.primarySoft,borderRadius:radius.md,padding:spacing.md},noteText:{...typography.secondary,color:colors.primaryDark,flex:1},list:{gap:spacing.sm},empty:{minHeight:180,backgroundColor:colors.surface,borderRadius:radius.md,alignItems:'center',justifyContent:'center'},emptyText:{...typography.body,color:colors.muted}});
