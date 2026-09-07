import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart3, CheckCircle2, Droplets, Leaf, ShieldCheck, Wrench } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { AccountField, AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { Fact, FarmSection, FarmSkeleton, farmUI } from '@/components/farm/FarmUI';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, spacing, typography } from '@/constants/theme';
import { farmService } from '@/services/farm';
import type { FarmReport } from '@/types/farm';

const year = new Date().getFullYear();
export default function FarmReportScreen() {
  const { farmId = '' } = useLocalSearchParams<{farmId:string}>();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const [from,setFrom]=useState(`${year}-01-01`),[to,setTo]=useState(new Date().toISOString().slice(0,10));
  const [report,setReport]=useState<FarmReport|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{setReport(await farmService.report(farmId,from,to));}catch{setError(ar?'تعذر إعداد التقرير. تحقق من الفترة.':'Could not prepare the report. Check the period.');}finally{setLoading(false);}};
  useEffect(()=>{if(farmId)void load();},[farmId]);
  return <AccountPage title={ar?'تقرير المزرعة':'Farm report'}>
    <View style={[styles.period,{flexDirection:isRTL?'row-reverse':'row'}]}><View style={styles.periodField}><AccountField label={ar?'من':'From'} value={from} onChangeText={setFrom} ltr placeholder="YYYY-MM-DD"/></View><View style={styles.periodField}><AccountField label={ar?'إلى':'To'} value={to} onChangeText={setTo} ltr placeholder="YYYY-MM-DD"/></View></View>
    <AppButton label={ar?'تحديث التقرير':'Refresh report'} onPress={()=>void load()} disabled={loading}/>
    {error?<Notice error text={error}/>:null}
    {loading&&!report?<FarmSkeleton/>:report?<>
      <View style={[styles.header,{alignItems:isRTL?'flex-end':'flex-start'}]}><BarChart3 size={26} color={colors.surface}/><Text style={[styles.title,{textAlign:isRTL?'right':'left'}]}>{report.farm.name}</Text><Text style={styles.date}>{report.period.from} · {report.period.to}</Text></View>
      <FarmSection title={ar?'الحقائق المسجلة':'Recorded facts'}><View style={[styles.facts,{flexDirection:isRTL?'row-reverse':'row'}]}><Fact icon={Leaf} value={report.facts.crops} label={ar?'دورات محصول':'Crop cycles'}/><Fact icon={Wrench} value={report.facts.operations} label={ar?'عمليات':'Operations'}/><Fact icon={Droplets} value={report.facts.irrigations} label={ar?'مرات ري':'Irrigations'}/><Fact icon={CheckCircle2} value={report.facts.tasksCompleted} label={ar?'مهام مكتملة':'Completed tasks'}/><Fact icon={ShieldCheck} value={report.facts.problemsResolved} label={ar?'مشكلات مغلقة':'Resolved problems'}/></View></FarmSection>
      <FarmSection title={ar?'الحصاد':'Harvest'}>{report.facts.harvests.length?<View style={farmUI.card}>{report.facts.harvests.map((item,index)=><View key={`${item.unit}-${item.customUnit}-${index}`} style={[styles.harvest,{flexDirection:isRTL?'row-reverse':'row'}]}><Text style={styles.harvestValue}>{item.quantity}</Text><Text style={styles.harvestUnit}>{item.unit==='custom'?item.customUnit:item.unit}</Text></View>)}</View>:<View style={farmUI.card}><Text style={[farmUI.body,{textAlign:isRTL?'right':'left'}]}>{ar?'لا يوجد حصاد مسجل في هذه الفترة.':'No harvest was recorded in this period.'}</Text></View>}</FarmSection>
      <Notice text={ar?'هذا التقرير يلخص سجلاتك كما أدخلتها. لا يحتوي على تقييم صحة مزرعة أو توصية آلية أو نتيجة مخترعة.' : 'This report summarizes your recorded data. It does not contain an invented farm-health score or automatic recommendation.'}/>
    </>:null}
  </AccountPage>;
}
const styles=StyleSheet.create({period:{gap:spacing.md,alignItems:'flex-start'},periodField:{flex:1,minWidth:0},header:{minHeight:128,backgroundColor:colors.primaryDark,padding:spacing.xl,justifyContent:'flex-end',gap:spacing.xs},title:{...typography.section,color:colors.surface},date:{...typography.caption,color:'#DCE8E0'},facts:{backgroundColor:colors.surface,padding:spacing.sm,flexWrap:'wrap'},harvest:{minHeight:44,alignItems:'center',gap:spacing.sm,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},harvestValue:{...typography.section,color:colors.text},harvestUnit:{...typography.body,color:colors.muted}});
