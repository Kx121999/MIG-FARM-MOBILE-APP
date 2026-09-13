import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { CalendarDays, CircleDollarSign, Sprout } from 'lucide-react-native';
import { AccountPage, Notice } from '@/components/account/AccountUI';
import { FarmRow, FarmSection, FarmSkeleton, farmUI } from '@/components/farm/FarmUI';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { farmCommandService } from '@/services/farmCommand';
import type { SeasonFarmReport } from '@/types/farm';

type Season={cropCycleId:string;cropName:string;variety:string;plantingDate:string|null;actualHarvestDate:string|null;generatedAt:string;report:SeasonFarmReport};
export default function SeasonHistoryScreen(){
  const {farmId=''}=useLocalSearchParams<{farmId:string}>(),{language,isRTL}=useLanguage(),ar=language==='ar';
  const [farmName,setFarmName]=useState(''),[seasons,setSeasons]=useState<Season[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=useCallback(async()=>{if(!farmId)return;setLoading(true);try{const result=await farmCommandService.seasonHistory(farmId);setFarmName(result.farm.name);setSeasons(result.seasons);}catch{setError(ar?'تعذر تحميل تاريخ المواسم.':'Could not load season history.');}finally{setLoading(false);}},[farmId,ar]);
  useEffect(()=>{void load();},[load]);
  if(loading)return <AccountPage title={ar?'تاريخ المواسم':'Season history'}><FarmSkeleton/><FarmSkeleton/></AccountPage>;
  return <AccountPage title={ar?'تاريخ المواسم':'Season history'}>
    <View style={styles.hero}><Text style={[styles.title,{textAlign:isRTL?'right':'left'}]}>{farmName}</Text><Text style={[styles.body,{textAlign:isRTL?'right':'left'}]}>{ar?'مقارنة من سجلات مزرعتك فقط':'Comparison from your farm records only'}</Text></View>
    {error?<Notice error text={error}/>:null}
    <Notice text={ar?'لا تُخلط هذه النتائج مع المراجع الزراعية العامة؛ كل رقم هنا مصدره مواسم مزرعتك المكتملة.':'These results are separate from agronomic reference data; every figure comes from your completed farm seasons.'}/>
    <FarmSection title={ar?'المواسم المكتملة':'Completed seasons'}>
      {seasons.length?<View style={styles.list}>{seasons.map((season)=><View key={season.cropCycleId} style={farmUI.card}><Text style={[styles.crop,{textAlign:isRTL?'right':'left'}]}>{season.cropName}{season.variety?` · ${season.variety}`:''}</Text><FarmRow icon={CalendarDays} title={ar?'مدة الموسم':'Season duration'} body={season.report.seasonDurationDays===null?(ar?'غير قابلة للحساب':'Not calculable'):(ar?`${season.report.seasonDurationDays} يوم`:`${season.report.seasonDurationDays} days`)}/><FarmRow icon={Sprout} title={ar?'إجمالي الحصاد':'Total harvest'} body={season.report.harvests.length?season.report.harvests.map((item)=>`${item.quantity} ${item.unit}`).join(' · '):(ar?'لا يوجد حصاد مسجل':'No recorded harvest')}/><FarmRow icon={CircleDollarSign} title={ar?'الهامش الإجمالي':'Gross margin'} body={`${(season.report.grossMarginMinor/100).toFixed(2)} ${season.report.currency||'AED'}`}/></View>)}</View>:<View style={styles.empty}><Sprout size={24} color={colors.primary}/><Text style={styles.emptyText}>{ar?'أكمل أول دورة محصول ليظهر تاريخ المواسم هنا.':'Complete the first crop cycle to build season history.'}</Text></View>}
    </FarmSection>
  </AccountPage>;
}
const styles=StyleSheet.create({hero:{backgroundColor:colors.primaryDark,borderRadius:radius.md,padding:spacing.xl,gap:spacing.xs},title:{...typography.page,color:colors.surface},body:{...typography.body,color:'#DCE9E0'},crop:{...typography.section,color:colors.text},list:{gap:spacing.md},empty:{minHeight:132,backgroundColor:colors.surface,borderRadius:radius.md,alignItems:'center',justifyContent:'center',padding:spacing.xl,gap:spacing.sm},emptyText:{...typography.body,color:colors.muted,textAlign:'center'}});
