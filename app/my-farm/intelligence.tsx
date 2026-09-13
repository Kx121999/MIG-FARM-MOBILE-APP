import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, BookOpenCheck, ChevronLeft, ChevronRight, Droplets, RefreshCw, Scale, ShieldCheck, Sprout } from 'lucide-react-native';
import { AccountPage } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { MotionPressable } from '@/components/Motion';
import { CropStateCard, DecisionCard, ProviderStatusRow, RiskCard } from '@/components/farm/FarmIntelligenceUI';
import { FarmSkeleton } from '@/components/farm/FarmUI';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFarmIntelligence } from '@/hooks/useFarmIntelligence';

export default function FarmIntelligenceScreen(){
  const params=useLocalSearchParams<{farmId?:string}>();
  const {user}=useAuth();
  const {language,isRTL}=useLanguage(),ar=language==='ar',Arrow=isRTL?ChevronLeft:ChevronRight;
  const state=useFarmIntelligence(typeof params.farmId==='string'?params.farmId:undefined,Boolean(user));
  const data=state.data;
  if(!user)return <AccountPage title={ar?'مركز ذكاء المزرعة':'Farm Intelligence'}><View style={styles.gate}><View style={styles.gateIcon}><Sprout size={28} color={colors.primary}/></View><Text style={styles.gateTitle}>{ar?'سجلات المزرعة خاصة بحسابك':'Farm records are private to your account'}</Text><Text style={styles.centerBody}>{ar?'سجل الدخول لعرض التحليل المبني على تاريخ مزرعتك.':'Sign in to view intelligence based on your farm history.'}</Text><AppButton label={ar?'تسجيل الدخول':'Sign in'} onPress={()=>router.push('/auth/login')}/></View></AccountPage>;
  return <AccountPage title={ar?'مركز ذكاء المزرعة':'Farm Intelligence'}>
    {state.loading&&!data?<><FarmSkeleton/><FarmSkeleton/></>:null}
    {state.error&&!data?<View style={styles.empty}><AlertTriangle size={24} color={colors.primary}/><Text style={styles.sectionTitle}>{ar?'تعذر تحميل مركز الذكاء':'Farm Intelligence is unavailable'}</Text><AppButton secondary label={ar?'إعادة المحاولة':'Try again'} onPress={state.refresh}/></View>:null}
    {data?<>
      <View style={styles.brief}><View style={[styles.briefTop,{flexDirection:isRTL?'row-reverse':'row'}]}><View style={styles.briefMark}><ShieldCheck size={22} color={colors.surface}/></View><Text style={[styles.briefEyebrow,{textAlign:isRTL?'right':'left'}]}>{ar?'تحليل حتمي من بيانات موثقة وسجلاتك':'Deterministic analysis from verified data and your records'}</Text></View><Text accessibilityRole="header" style={[styles.briefTitle,{textAlign:isRTL?'right':'left'}]}>{ar?data.brief.titleAr:data.brief.titleEn}</Text><Text style={[styles.briefBody,{textAlign:isRTL?'right':'left'}]}>{ar?data.brief.summaryAr:data.brief.summaryEn}</Text><View style={[styles.metrics,{flexDirection:isRTL?'row-reverse':'row'}]}><Metric value={data.brief.riskCount} label={ar?'مخاطر':'Risks'}/><Metric value={data.brief.anomalyCount} label={ar?'تغيّرات':'Changes'}/><Metric value={data.brief.cropCount} label={ar?'محاصيل':'Crops'}/></View></View>
      {state.cached?<Text style={[styles.cache,{textAlign:isRTL?'right':'left'}]}>{ar?'نسخة محفوظة، جارٍ التحقق من التحديث.':'Cached brief while checking for updates.'}</Text>:null}

      <SectionHeading title={ar?'ما يحتاج انتباهك':'Needs attention now'} action={data.risks.length>3?(ar?'عرض الكل':'View all'):undefined} onPress={()=>router.push({pathname:'/my-farm/risks' as never,params:{farmId:data.farmId||''}})}/>
      {data.risks.length?<View style={styles.list}>{data.risks.slice(0,3).map((risk)=><RiskCard key={risk.id} risk={risk}/>)}</View>:<QuietState text={ar?'لا توجد مخاطر مسجلة الآن.':'No recorded risks right now.'}/>} 

      <SectionHeading title={ar?'الخطوة التالية':'Next actions'}/>
      {data.decisionCards.length?<View style={styles.list}>{data.decisionCards.slice(0,3).map((item)=><DecisionCard key={item.id} item={item}/>)}</View>:<QuietState text={ar?'لا توجد إجراءات إضافية بناءً على البيانات الحالية.':'No additional actions from current data.'}/>} 

      <SectionHeading title={ar?'حالة المحاصيل':'Crop states'}/>
      {data.cropStates.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>{data.cropStates.map((crop)=><CropStateCard key={crop.cropId} state={crop} onPress={()=>router.push({pathname:'/my-farm/crop/[id]',params:{id:crop.cropId}})}/>)}</ScrollView>:<QuietState text={ar?'أضف محصولًا لتكوين حالته الرقمية.':'Add a crop to build its digital state.'}/>} 

      <SectionHeading title={ar?'المعالم القادمة':'Upcoming milestones'}/>
      <View style={styles.list}>{data.forecasts.map((forecast)=><ForecastCard key={forecast.cropId} forecast={forecast} ar={ar} rtl={isRTL}/>)}</View>

      <SectionHeading title={ar?'مصادر البيانات الحية':'Live data providers'}/>
      <View style={styles.providerList}><ProviderStatusRow kind="weather" status={data.providerStatus.weather}/><ProviderStatusRow kind="vision" status={data.providerStatus.vision}/><ProviderStatusRow kind="sensor" status={data.providerStatus.sensor}/></View>

      <SectionHeading title={ar?'مراكز موثقة':'Verified centers'}/>
      <View style={styles.tools}><Tool icon={Droplets} title={ar?'جودة مياه الري':'Irrigation water quality'} body={ar?'قارن قياس EC بمرجع FAO دون وصف علاج.':'Compare an EC measurement with FAO references without prescribing treatment.'} onPress={()=>router.push('/my-farm/water-quality' as never)} rtl={isRTL}/><Tool icon={Scale} title={ar?'لوائح وخدمات الإمارات':'UAE regulations and services'} body={ar?'مصادر رسمية مع تاريخ التحقق.':'Official sources with verification dates.'} onPress={()=>router.push('/my-farm/regulations' as never)} rtl={isRTL}/><Tool icon={BookOpenCheck} title={ar?'المكتبة الموثقة':'Verified library'} body={ar?'بحث عربي وإنجليزي داخل المعرفة المتاحة.':'Arabic and English search across available knowledge.'} onPress={()=>router.push('/my-farm/library')} rtl={isRTL}/></View>
      <View style={[styles.updated,{flexDirection:isRTL?'row-reverse':'row'}]}><RefreshCw size={15} color={colors.muted}/><Text style={styles.cache}>{ar?'آخر تحليل: ':'Last analysis: '}{new Date(data.generatedAt).toLocaleString(ar?'ar-AE':'en-AE')}</Text></View>
      <AppButton secondary disabled={state.refreshing} label={state.refreshing?(ar?'جارٍ التحديث...':'Refreshing...'):(ar?'تحديث التحليل':'Refresh intelligence')} onPress={state.refresh}/>
    </>:null}
  </AccountPage>;
}

function Metric({value,label}:{value:number;label:string}){return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text numberOfLines={1} style={styles.metricLabel}>{label}</Text></View>}
function SectionHeading({title,action,onPress}:{title:string;action?:string;onPress?:()=>void}){const {isRTL}=useLanguage();return <View style={[styles.heading,{flexDirection:isRTL?'row-reverse':'row'}]}><Text style={[styles.sectionTitle,{textAlign:isRTL?'right':'left'}]}>{title}</Text>{action&&onPress?<MotionPressable accessibilityRole="button" onPress={onPress}><Text style={styles.action}>{action}</Text></MotionPressable>:null}</View>}
function QuietState({text}:{text:string}){return <View style={styles.quiet}><Text style={styles.centerBody}>{text}</Text></View>}
function ForecastCard({forecast,ar,rtl}:{forecast:NonNullable<ReturnType<typeof useFarmIntelligence>['data']>['forecasts'][number];ar:boolean;rtl:boolean}){const available=forecast.harvest.status==='forecast_available'&&forecast.harvest.expectedWindow;return <View style={styles.forecast}><Text style={[styles.toolTitle,{textAlign:rtl?'right':'left'}]}>{forecast.crop}</Text><Text style={[styles.forecastValue,{textAlign:rtl?'right':'left'}]}>{available?`${forecast.harvest.expectedWindow?.from} - ${forecast.harvest.expectedWindow?.to}`:(ar?'لا توجد بيانات كافية للتوقع':'Insufficient data for a forecast')}</Text><Text style={[styles.cache,{textAlign:rtl?'right':'left'}]}>{available?(ar?'نافذة متوقعة وليست موعدًا مضمونًا':'Expected window, not a guaranteed date'):(ar?'لم يتم إنشاء رقم من بيانات ناقصة':'No number was created from missing data')}</Text></View>}
function Tool({icon:Icon,title,body,onPress,rtl}:{icon:typeof Droplets;title:string;body:string;onPress:()=>void;rtl:boolean}){const Arrow=rtl?ChevronLeft:ChevronRight;return <MotionPressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={[styles.tool,{flexDirection:rtl?'row-reverse':'row'}]}><View style={styles.toolIcon}><Icon size={20} color={colors.primary}/></View><View style={styles.toolCopy}><Text style={[styles.toolTitle,{textAlign:rtl?'right':'left'}]}>{title}</Text><Text numberOfLines={2} style={[styles.centerBody,{textAlign:rtl?'right':'left'}]}>{body}</Text></View><Arrow size={18} color={colors.muted}/></MotionPressable>}

const styles=StyleSheet.create({
  brief:{backgroundColor:colors.primaryDark,borderRadius:radius.md,padding:spacing.xl,gap:spacing.md},briefTop:{alignItems:'center',gap:spacing.sm},briefMark:{width:40,height:40,borderRadius:radius.md,backgroundColor:'rgba(255,255,255,0.1)',alignItems:'center',justifyContent:'center'},briefEyebrow:{...typography.caption,color:'#DCE9E0',flex:1},briefTitle:{...typography.page,color:colors.surface},briefBody:{...typography.body,color:'#DCE9E0'},metrics:{gap:spacing.sm},metric:{flex:1,minWidth:0,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:radius.sm,padding:spacing.md,alignItems:'center'},metricValue:{...typography.page,color:colors.surface},metricLabel:{...typography.caption,color:'#DCE9E0'},
  heading:{alignItems:'center',marginTop:spacing.lg,gap:spacing.md},sectionTitle:{...typography.section,color:colors.text,flex:1},action:{...typography.button,color:colors.primary},list:{gap:spacing.sm},rail:{gap:spacing.md},quiet:{minHeight:88,borderRadius:radius.md,backgroundColor:colors.surface,padding:spacing.lg,alignItems:'center',justifyContent:'center'},providerList:{backgroundColor:colors.surface,borderRadius:radius.md,paddingHorizontal:spacing.md},tools:{backgroundColor:colors.surface,borderRadius:radius.md,paddingHorizontal:spacing.md},tool:{minHeight:74,alignItems:'center',gap:spacing.md,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},toolIcon:{width:40,height:40,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},toolCopy:{flex:1,minWidth:0},toolTitle:{...typography.button,color:colors.text},centerBody:{...typography.body,color:colors.muted,textAlign:'center'},updated:{alignItems:'center',justifyContent:'center',gap:spacing.sm,marginTop:spacing.md},cache:{...typography.caption,color:colors.muted},
  forecast:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.md,gap:spacing.xs},forecastValue:{...typography.button,color:colors.primaryDark},gate:{minHeight:380,alignItems:'center',justifyContent:'center',gap:spacing.md},gateIcon:{width:58,height:58,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},gateTitle:{...typography.section,color:colors.text,textAlign:'center'},empty:{minHeight:260,alignItems:'center',justifyContent:'center',gap:spacing.md},
});
