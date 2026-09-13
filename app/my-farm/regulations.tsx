import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Scale } from 'lucide-react-native';
import { AccountPage } from '@/components/account/AccountUI';
import { VerifiedSourceLink } from '@/components/farm/FarmIntelligenceUI';
import { FarmSkeleton } from '@/components/farm/FarmUI';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { farmIntelligenceService } from '@/services/farmIntelligence';
import type { VerifiedKnowledgeRecord } from '@/types/farm';

export default function UAERegulationsScreen(){
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  const [items,setItems]=useState<VerifiedKnowledgeRecord[]>([]),[disclaimer,setDisclaimer]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let active=true;farmIntelligenceService.regulations().then((result)=>{if(!active)return;setItems(result.items);setDisclaimer(ar?result.disclaimerAr:result.disclaimerEn);}).catch(()=>{if(active)setError(ar?'تعذر تحميل السجل الرسمي.':'The official registry could not be loaded.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[ar]);
  return <AccountPage title={ar?'لوائح وخدمات الإمارات':'UAE regulations and services'}>
    <View style={styles.notice}><Scale size={20} color={colors.primary}/><Text style={[styles.noticeText,{textAlign:isRTL?'right':'left'}]}>{disclaimer|| (ar?'قد تتغير المتطلبات. تحقق من المتطلبات الحالية لدى الجهة الرسمية.':'Requirements may change. Confirm current requirements with the official authority.')}</Text></View>
    {loading?<><FarmSkeleton/><FarmSkeleton/></>:null}
    {error?<Text style={styles.error}>{error}</Text>:null}
    <View style={styles.list}>{items.map((item)=><View key={item.id} style={styles.item}><Text style={[styles.category,{textAlign:isRTL?'right':'left'}]}>{String(item.payload.category||item.type).replaceAll('_',' ')}</Text><Text style={[styles.title,{textAlign:isRTL?'right':'left'}]}>{String(item.payload[ar?'title_ar':'title_en']||item.payload.title||item.id)}</Text><Text style={[styles.body,{textAlign:isRTL?'right':'left'}]}>{String(item.payload[ar?'summary_ar':'summary_en']||item.payload.summary||'')}</Text>{item.sources.map((source)=><VerifiedSourceLink key={source.id} source={source}/>)}</View>)}</View>
  </AccountPage>;
}
const styles=StyleSheet.create({notice:{flexDirection:'row',alignItems:'flex-start',gap:spacing.md,backgroundColor:colors.primarySoft,borderRadius:radius.md,padding:spacing.md},noticeText:{...typography.secondary,color:colors.primaryDark,flex:1},list:{gap:spacing.sm},item:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.lg,gap:spacing.sm},category:{...typography.caption,color:colors.primary,textTransform:'uppercase'},title:{...typography.section,color:colors.text},body:{...typography.body,color:colors.muted},error:{...typography.body,color:colors.danger,textAlign:'center'}});
