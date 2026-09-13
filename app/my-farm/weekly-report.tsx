import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AlertTriangle, CheckCircle2, Droplets, Image, NotebookPen, ReceiptText, Sprout, TrendingUp } from 'lucide-react-native';
import { AccountPage, Notice } from '@/components/account/AccountUI';
import { FarmRow, FarmSection, FarmSkeleton, farmUI } from '@/components/farm/FarmUI';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { farmCommandService } from '@/services/farmCommand';
import type { WeeklyFarmReport } from '@/types/farm';

export default function WeeklyReportScreen(){
  const {farmId=''}=useLocalSearchParams<{farmId:string}>(),{language,isRTL}=useLanguage(),ar=language==='ar';
  const [farmName,setFarmName]=useState(''),[report,setReport]=useState<WeeklyFarmReport|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=useCallback(async()=>{if(!farmId)return;setLoading(true);setError('');try{const result=await farmCommandService.weeklyReport(farmId);setFarmName(result.farm.name);setReport(result.report);}catch{setError(ar?'تعذر إعداد التقرير الأسبوعي.':'Could not prepare the weekly report.');}finally{setLoading(false);}},[farmId,ar]);
  useEffect(()=>{void load();},[load]);
  if(loading)return <AccountPage title={ar?'التقرير الأسبوعي':'Weekly report'}><FarmSkeleton/><FarmSkeleton/></AccountPage>;
  if(!report)return <AccountPage title={ar?'التقرير الأسبوعي':'Weekly report'}><Notice error text={error}/></AccountPage>;
  const facts=[
    {icon:CheckCircle2,ar:'مهام مكتملة',en:'Tasks completed',value:report.tasksCompleted},{icon:AlertTriangle,ar:'مهام متأخرة',en:'Tasks overdue',value:report.tasksOverdue},
    {icon:Droplets,ar:'سجلات ري',en:'Irrigation records',value:report.irrigationRecords},{icon:NotebookPen,ar:'عمليات',en:'Operations',value:report.operations},
    {icon:AlertTriangle,ar:'مشاكل جديدة',en:'Problems opened',value:report.problemsOpened},{icon:CheckCircle2,ar:'مشاكل محلولة',en:'Problems resolved',value:report.problemsResolved},
    {icon:Sprout,ar:'تغييرات مرحلة',en:'Stage changes',value:report.stageChanges},{icon:Image,ar:'صور مضافة',en:'Photos added',value:report.photosAdded},
  ];
  return <AccountPage title={ar?'التقرير الأسبوعي':'Weekly report'}>
    <View style={styles.hero}><Text style={[styles.farm,{textAlign:isRTL?'right':'left'}]}>{farmName}</Text><Text style={[styles.period,{textAlign:isRTL?'right':'left'}]}>{formatDate(report.period.from,ar)} - {formatDate(report.period.to,ar)}</Text><Text style={[styles.source,{textAlign:isRTL?'right':'left'}]}>{ar?'ملخص من سجلات المزرعة الفعلية':'Summary from actual farm records'}</Text></View>
    {error?<Notice error text={error}/>:null}
    <FarmSection title={ar?'ملخص الأسبوع':'Week summary'}><View style={farmUI.card}>{facts.map((fact)=><FarmRow key={fact.en} icon={fact.icon} title={ar?fact.ar:fact.en} body={String(fact.value)}/>)}</View></FarmSection>
    <FarmSection title={ar?'الحصاد':'Harvest'}>{report.harvests.length?<View style={farmUI.card}>{report.harvests.map((item)=><FarmRow key={item.unit} icon={Sprout} title={`${item.quantity} ${item.unit}`} body={ar?`${item.events} سجلات`:`${item.events} record(s)`}/>)}</View>:<Quiet text={ar?'لا توجد كميات حصاد مسجلة خلال الفترة.':'No harvest quantities were recorded in this period.'}/>}</FarmSection>
    <FarmSection title={ar?'المالية':'Finance'}><View style={[styles.money,{flexDirection:isRTL?'row-reverse':'row'}]}><Money icon={ReceiptText} label={ar?'مصروفات':'Expenses'} value={report.expensesMinor}/><Money icon={TrendingUp} label={ar?'مبيعات':'Sales'} value={report.salesMinor}/><Money icon={TrendingUp} label={ar?'هامش إجمالي':'Gross margin'} value={report.salesMinor-report.expensesMinor}/></View></FarmSection>
    <Notice text={ar?'لا توجد مقارنة مع أسبوع سابق لأن النظام لا يعرض مقارنة قبل توافر فترة قابلة للمقارنة بنفس الشروط.':'No prior-week comparison is shown until a genuinely comparable period is available.'}/>
  </AccountPage>;
}
function Money({icon:Icon,label,value}:{icon:typeof ReceiptText;label:string;value:number}){return <View style={styles.moneyItem}><Icon size={18} color={colors.primary}/><Text style={styles.moneyLabel}>{label}</Text><Text numberOfLines={1} style={styles.moneyValue}>{(value/100).toFixed(2)} AED</Text></View>}
function Quiet({text}:{text:string}){return <View style={styles.quiet}><Text style={styles.quietText}>{text}</Text></View>}
function formatDate(value:string,ar:boolean){return new Intl.DateTimeFormat(ar?'ar-AE':'en-AE',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value))}
const styles=StyleSheet.create({hero:{backgroundColor:colors.primaryDark,borderRadius:radius.md,padding:spacing.xl,gap:spacing.xs},farm:{...typography.page,color:colors.surface},period:{...typography.button,color:'#DCE9E0'},source:{...typography.caption,color:'#C4DACB'},money:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.sm,gap:spacing.xs,flexWrap:'wrap'},moneyItem:{flex:1,minWidth:98,padding:spacing.sm,gap:3},moneyLabel:{...typography.caption,color:colors.muted},moneyValue:{...typography.button,color:colors.primaryDark},quiet:{minHeight:88,backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.lg,justifyContent:'center'},quietText:{...typography.body,color:colors.muted,textAlign:'center'}});
