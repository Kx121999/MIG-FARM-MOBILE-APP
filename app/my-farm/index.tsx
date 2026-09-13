import React, { useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AlertTriangle, BarChart3, BookOpenCheck, Calculator, Camera, ChevronLeft, ChevronRight, CircleGauge, CloudOff, Droplets, FilePlus2, History, Leaf, ListTodo, NotebookPen, Package, ReceiptText, ScanSearch, Sprout, X, type LucideIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppIconButton } from '@/components/AppIconButton';
import { EmptyState } from '@/components/ScreenState';
import { MotionPressable } from '@/components/Motion';
import { CommandActionCard, CropMissionCard, StatusReasonRow } from '@/components/farm/FarmCommandUI';
import { FarmRow, FarmSection, FarmSkeleton, farmUI } from '@/components/farm/FarmUI';
import { useAuth } from '@/contexts/AuthContext';
import { useFarm } from '@/contexts/FarmContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFarmToday } from '@/hooks/useFarmToday';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { CropMission, FarmCommandStatus, FarmPriorityAction } from '@/types/farm';

const statusLabels = {
  tasks:{ar:'المهام',en:'Tasks'}, irrigationRecords:{ar:'سجلات الري',en:'Irrigation records'},
  openProblems:{ar:'المشاكل المفتوحة',en:'Open problems'}, cropProgress:{ar:'تقدم المحصول',en:'Crop progress'},
  dataCompleteness:{ar:'اكتمال البيانات',en:'Data completeness'}, harvestReadiness:{ar:'جاهزية الحصاد',en:'Harvest readiness'},
};

export default function FarmTodayScreen() {
  const {user,ready}=useAuth();
  const {dashboard,loading:dashboardLoading,refreshing:dashboardRefreshing,error:dashboardError,pendingCount,refresh:refreshDashboard,submit}=useFarm();
  const {language,isRTL}=useLanguage(),ar=language==='ar',Arrow=isRTL?ChevronLeft:ChevronRight;
  const [selectedFarmId,setSelectedFarmId]=useState<string|undefined>();
  const [statusOpen,setStatusOpen]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const command=useFarmToday(selectedFarmId);
  const selectedFarm=dashboard?.farms.find(item=>item.id===selectedFarmId)||dashboard?.farms[0];
  const currentMission=command.data?.missions[0]||null;
  const dateLabel=new Intl.DateTimeFormat(ar?'ar-AE':'en-AE',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  const refreshing=dashboardRefreshing||command.refreshing;
  const refresh=async()=>{await Promise.all([refreshDashboard(),command.refresh()]);};
  const complete=async(action:FarmPriorityAction)=>{if(!action.entityId)return;setBusy(action.id);setNotice('');try{const result=await submit('complete_task',{taskId:action.entityId});setNotice(result==='queued'?(ar?'تم حفظ الإجراء للمزامنة.':'Saved for sync.'):(ar?'تم إكمال المهمة.':'Task completed.'));await command.refresh();}catch{setNotice(ar?'تعذر إكمال المهمة.':'Could not complete the task.');}finally{setBusy(null);}};
  const openAction=(action:FarmPriorityAction)=>{
    const mission=command.data?.missions.find(item=>item.id===action.cropCycleId);
    if(action.kind.includes('problem')&&action.entityId)return router.push({pathname:'/my-farm/problem/[id]',params:{id:action.entityId}});
    if(action.action==='record_irrigation')return router.push({pathname:'/my-farm/add',params:{type:'irrigation',farmId:action.farmId,zoneId:mission?.zone?.id||'',cropId:action.cropCycleId||''}});
    if(action.cropCycleId)return router.push({pathname:'/my-farm/crop/[id]',params:{id:action.cropCycleId}});
    router.push('/my-farm/calendar');
  };
  const quickRoute=(type:string,mission:CropMission|null)=>{
    if(type==='expense'||type==='sale')return router.push({pathname:'/my-farm/finance',params:{type,farmId:selectedFarm?.id||'',cropId:mission?.id||''}});
    if(type==='photo'&&mission)return router.push({pathname:'/my-farm/crop/[id]',params:{id:mission.id,section:'photos'}});
    router.push({pathname:'/my-farm/add',params:{type,farmId:selectedFarm?.id||'',zoneId:mission?.zone?.id||'',cropId:mission?.id||''}});
  };

  if(!ready||dashboardLoading&&!dashboard)return <SafeAreaView style={farmUI.safe} edges={['top']}><AppHeader compact/><View style={farmUI.page}><FarmSkeleton/><FarmSkeleton/></View></SafeAreaView>;
  if(!user)return <GuestGate ar={ar}/>;
  if(dashboardError&&!dashboard)return <SafeAreaView style={farmUI.safe} edges={['top']}><AppHeader compact/><EmptyState icon={CloudOff} title={ar?'تعذر تحميل مزرعتك':'Could not load your farm'} body={ar?'تحقق من الاتصال ثم حاول مرة أخرى.':'Check your connection and try again.'} action={ar?'إعادة المحاولة':'Try again'} onAction={refreshDashboard}/></SafeAreaView>;
  if(!dashboard?.farms.length)return <SafeAreaView style={farmUI.safe} edges={['top']}><AppHeader compact/><EmptyState icon={Sprout} title={ar?'ابدأ مزرعتك':'Start your farm'} body={ar?'أضف بيانات المزرعة ثم خطط لأول محصول.':'Add your farm details, then plan your first crop.'} action={ar?'إعداد أول مزرعة':'Set up your first farm'} onAction={()=>router.push('/my-farm/setup')}/></SafeAreaView>;

  return <SafeAreaView style={farmUI.safe} edges={['top']}>
    <AppHeader compact/>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary}/>} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={[styles.heading,{flexDirection:isRTL?'row-reverse':'row'}]}><View style={styles.headingCopy}><Text style={[styles.date,{textAlign:isRTL?'right':'left'}]}>{dateLabel}</Text><Text accessibilityRole="header" style={[styles.title,{textAlign:isRTL?'right':'left'}]}>{ar?'مزرعتي اليوم':'Farm Today'}</Text></View><AppIconButton icon={BarChart3} label={ar?'التقرير الأسبوعي':'Weekly report'} onPress={()=>selectedFarm&&router.push({pathname:'/my-farm/weekly-report',params:{farmId:selectedFarm.id}})}/></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.farmRail}>{dashboard.farms.map(farm=><MotionPressable key={farm.id} accessibilityRole="button" accessibilityLabel={farm.name} onPress={()=>setSelectedFarmId(farm.id)} style={[styles.farmChoice,selectedFarm?.id===farm.id&&styles.farmChoiceActive]}><Text numberOfLines={1} style={[styles.farmChoiceText,selectedFarm?.id===farm.id&&styles.farmChoiceTextActive]}>{farm.name}</Text></MotionPressable>)}</ScrollView>
      {pendingCount?<Text style={[farmUI.caption,{textAlign:isRTL?'right':'left'}]}>{ar?`${pendingCount} إجراء بانتظار المزامنة`:`${pendingCount} change(s) waiting to sync`}</Text>:null}
      {command.cached?<Text style={[farmUI.caption,{textAlign:isRTL?'right':'left'}]}>{ar?'تعرض نسخة محفوظة لحين اكتمال التحديث.':'Showing a cached command view while refreshing.'}</Text>:null}
      {notice?<Text accessibilityLiveRegion="polite" style={[farmUI.caption,{color:colors.primary,textAlign:isRTL?'right':'left'}]}>{notice}</Text>:null}
      {command.loading&&!command.data?<FarmSkeleton/>:command.error&&!command.data?<CommandUnavailable ar={ar}/>:command.data?<>
        <View style={styles.brief}><Text style={[styles.briefEyebrow,{textAlign:isRTL?'right':'left'}]}>{ar?`صباح الخير، ${user.name.split(' ')[0]}`:`Good morning, ${user.name.split(' ')[0]}`}</Text><Text style={[styles.briefTitle,{textAlign:isRTL?'right':'left'}]}>{briefCopy(command.data.morningBrief,ar)}</Text><View style={[styles.briefFacts,{flexDirection:isRTL?'row-reverse':'row'}]}><BriefFact value={command.data.morningBrief.tasks} label={ar?'مهام':'Tasks'}/><BriefFact value={command.data.morningBrief.problemFollowUps} label={ar?'متابعات':'Follow-ups'}/><BriefFact value={command.data.morningBrief.irrigationChecks} label={ar?'فحص ري':'Irrigation'}/></View></View>
        <FarmSection title={ar?'المطلوب منك اليوم':'What needs you today'}>
          {command.data.topActions.length?<View style={styles.actionList}>{command.data.topActions.map(action=><CommandActionCard key={action.id} item={action} busy={busy===action.id} onPress={()=>openAction(action)} onComplete={action.action==='complete_task'?()=>complete(action):undefined}/>)}</View>:<QuietEmpty icon={ListTodo} text={ar?'لا توجد مهام مطلوبة اليوم.':'No actions are required today.'}/>}
        </FarmSection>
        <FarmSection title={ar?'محاصيلي':'My crops'} action={ar?'خطط محصولًا':'Plan a crop'} onAction={()=>router.push('/my-farm/plan-crop')}>
          {command.data.missions.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.missionRail}>{command.data.missions.map(mission=><CropMissionCard key={mission.id} mission={mission} onPress={()=>router.push({pathname:'/my-farm/crop/[id]',params:{id:mission.id}})}/>)}</ScrollView>:<QuietEmpty icon={Leaf} text={ar?'خطط لأول محصول لتبدأ المتابعة اليومية.':'Plan your first crop to begin daily guidance.'}/>}
        </FarmSection>
        {command.changes.length?<FarmSection title={ar?'من آخر زيارة':'Since your last visit'}><View style={farmUI.card}>{command.changes.slice(0,5).map((change,index)=><FarmRow key={String(change.id||index)} icon={CircleGauge} title={changeCopy(change,ar)} body={change.eventAt?new Intl.DateTimeFormat(ar?'ar-AE':'en-AE',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(String(change.eventAt))):undefined}/>)}</View></FarmSection>:null}
        <MotionPressable accessibilityRole="button" accessibilityLabel={ar?'هل مزرعتي ماشية صح؟':'How is my farm doing?'} onPress={()=>setStatusOpen(true)} style={[styles.statusCta,{flexDirection:isRTL?'row-reverse':'row'}]}><View style={styles.statusIcon}><CircleGauge size={22} color={colors.primary}/></View><View style={styles.grow}><Text style={[styles.statusTitle,{textAlign:isRTL?'right':'left'}]}>{ar?'هل مزرعتي ماشية صح؟':'How is my farm doing?'}</Text><Text style={[farmUI.caption,{textAlign:isRTL?'right':'left'}]}>{ar?'ملخص واضح من سجلات مزرعتك فقط':'A clear summary from your farm records only'}</Text></View><Arrow size={19} color={colors.primary}/></MotionPressable>
        <FarmSection title={ar?'تسجيل سريع':'Quick actions'}><View style={styles.quickGrid}>{quickActions.map(item=><QuickAction key={item.type} item={item} onPress={()=>quickRoute(item.type,currentMission)}/>)}</View></FarmSection>
        <FarmSection title={ar?'الأدوات':'Tools'}><View style={styles.toolList}><ToolRow icon={Calculator} title={ar?'حاسبات المزرعة':'Farm calculators'} onPress={()=>router.push('/my-farm/planting-calculator')}/><ToolRow icon={ScanSearch} title={ar?'تشخيص إرشادي':'Guided diagnosis'} onPress={()=>router.push('/my-farm/diagnose')}/><ToolRow icon={BookOpenCheck} title={ar?'المكتبة الموثقة':'Verified library'} onPress={()=>router.push('/my-farm/library')}/><ToolRow icon={Package} title={ar?'مخزون المزرعة':'Farm inventory'} onPress={()=>selectedFarm&&router.push({pathname:'/my-farm/inventory',params:{farmId:selectedFarm.id}})}/><ToolRow icon={History} title={ar?'تاريخ المواسم':'Season history'} onPress={()=>selectedFarm&&router.push({pathname:'/my-farm/season-history',params:{farmId:selectedFarm.id}})}/></View></FarmSection>
        <View style={styles.weather}><CloudOff size={18} color={colors.muted}/><Text style={[farmUI.caption,{textAlign:isRTL?'right':'left',flex:1}]}>{command.data.weather.weatherStatus==='not_configured'?(ar?'بيانات الطقس غير متصلة حاليًا.':'Weather data is not connected currently.'):(ar?'مزود الطقس غير مدعوم حاليًا.':'The weather provider is not supported yet.')}</Text></View>
      </>:null}
    </ScrollView>
    {command.data?<StatusModal visible={statusOpen} onClose={()=>setStatusOpen(false)} statuses={command.data.status} ar={ar}/>:null}
  </SafeAreaView>;
}

const quickActions:Array<{type:string;icon:LucideIcon;ar:string;en:string}>=[
  {type:'irrigation',icon:Droplets,ar:'سجل ري',en:'Irrigation'}, {type:'task',icon:ListTodo,ar:'أضف مهمة',en:'Add task'},
  {type:'problem',icon:AlertTriangle,ar:'أبلغ عن مشكلة',en:'Report problem'}, {type:'operation',icon:NotebookPen,ar:'سجل عملية',en:'Operation'},
  {type:'photo',icon:Camera,ar:'أضف صورة',en:'Add photo'}, {type:'harvest',icon:Sprout,ar:'سجل حصاد',en:'Harvest'},
  {type:'expense',icon:ReceiptText,ar:'أضف مصروف',en:'Expense'}, {type:'note',icon:FilePlus2,ar:'أضف ملاحظة',en:'Add note'},
];
function QuickAction({item,onPress}:{item:typeof quickActions[number];onPress:()=>void}){const {language}=useLanguage();return <MotionPressable accessibilityRole="button" accessibilityLabel={language==='ar'?item.ar:item.en} onPress={onPress} style={styles.quick}><item.icon size={20} color={colors.primary}/><Text numberOfLines={2} style={styles.quickText}>{language==='ar'?item.ar:item.en}</Text></MotionPressable>}
function ToolRow({icon:Icon,title,onPress}:{icon:LucideIcon;title:string;onPress:()=>void}){const {isRTL}=useLanguage(),Arrow=isRTL?ChevronLeft:ChevronRight;return <MotionPressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={[styles.toolRow,{flexDirection:isRTL?'row-reverse':'row'}]}><Icon size={20} color={colors.primary}/><Text style={[styles.toolTitle,{textAlign:isRTL?'right':'left'}]}>{title}</Text><Arrow size={18} color={colors.muted}/></MotionPressable>}
function BriefFact({value,label}:{value:number;label:string}){return <View style={styles.briefFact}><Text style={styles.briefValue}>{value}</Text><Text style={styles.briefLabel}>{label}</Text></View>}
function QuietEmpty({icon:Icon,text}:{icon:LucideIcon;text:string}){return <View style={styles.empty}><Icon size={22} color={colors.primary}/><Text style={styles.emptyText}>{text}</Text></View>}
function GuestGate({ar}:{ar:boolean}){return <SafeAreaView style={farmUI.safe} edges={['top']}><AppHeader compact/><View style={styles.gate}><View style={styles.gateIcon}><Sprout size={32} color={colors.primary}/></View><Text style={styles.gateTitle}>{ar?'مزرعتك اليومية تبدأ بحسابك':'Your daily farm starts with your account'}</Text><Text style={styles.gateBody}>{ar?'سجلات المزرعة خاصة بك وتبقى منفصلة وآمنة.':'Your farm records remain private and isolated.'}</Text><AppButton label={ar?'تسجيل الدخول':'Sign in'} onPress={()=>router.push('/auth/login')}/><AppButton secondary label={ar?'إنشاء حساب':'Create account'} onPress={()=>router.push('/auth/register')}/></View></SafeAreaView>}
function CommandUnavailable({ar}:{ar:boolean}){return <View style={styles.unavailable}><CloudOff size={24} color={colors.primary}/><Text style={styles.unavailableTitle}>{ar?'مركز قيادة المزرعة يحتاج نشر Backend V4':'Farm Command Center needs the V4 backend deployment'}</Text><Text style={styles.emptyText}>{ar?'بيانات V3 لم تتغير. انشر migration 007 ومسارات API الجديدة لتفعيل العرض اليومي.':'V3 data is unchanged. Deploy migration 007 and the new API routes to enable Farm Today.'}</Text></View>}
function StatusModal({visible,onClose,statuses,ar}:{visible:boolean;onClose:()=>void;statuses:Record<string,FarmCommandStatus>;ar:boolean}){const {isRTL}=useLanguage();return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}><View style={styles.scrim}><SafeAreaView edges={['bottom']} style={styles.sheet}><View style={[styles.sheetTop,{flexDirection:isRTL?'row-reverse':'row'}]}><View style={styles.grow}><Text style={[styles.sheetTitle,{textAlign:isRTL?'right':'left'}]}>{ar?'حالة المزرعة':'Farm status'}</Text><Text style={[farmUI.caption,{textAlign:isRTL?'right':'left'}]}>{ar?'لا نستخدم درجة صحة وهمية. كل مؤشر مستقل وله سبب.':'No artificial health score. Each status stands on its own.'}</Text></View><AppIconButton icon={X} label={ar?'إغلاق':'Close'} onPress={onClose}/></View><ScrollView>{Object.entries(statuses).map(([key,status])=><StatusReasonRow key={key} label={statusLabels[key as keyof typeof statusLabels]?.[ar?'ar':'en']||key} status={status} reason={statusReason(key,status,ar)}/>)}</ScrollView><AppButton label={ar?'تم':'Done'} onPress={onClose}/></SafeAreaView></View></Modal>}
function briefCopy(brief:{tasks:number;problemFollowUps:number;irrigationChecks:number},ar:boolean){const total=brief.tasks+brief.problemFollowUps+brief.irrigationChecks;return total?(ar?`عندك ${total} إجراءات تحتاج مراجعتك`:`You have ${total} actions to review`):(ar?'يومك هادئ حسب السجلات الحالية':'Your day is clear based on current records')}
function changeCopy(change:Record<string,unknown>,ar:boolean){if(change.eventType==='tasks_became_overdue')return ar?`${change.count} مهام أصبحت متأخرة`:`${change.count} tasks became overdue`;const labels:Record<string,{ar:string;en:string}>={stage_confirmed:{ar:'تم تأكيد مرحلة محصول',en:'A crop stage was confirmed'},problem_updated:{ar:'تم تحديث مشكلة',en:'A problem was updated'},problem_resolved:{ar:'تم حل مشكلة',en:'A problem was resolved'},harvest_recorded:{ar:'تم تسجيل حصاد',en:'A harvest was recorded'},operation_recorded:{ar:'تم تسجيل عملية',en:'An operation was recorded'},checkin_recorded:{ar:'تم تسجيل المتابعة اليومية',en:'A daily check-in was recorded'}};return labels[String(change.eventType)]?.[ar?'ar':'en']||(ar?'تم تحديث سجل المزرعة':'A farm record was updated')}
function statusReason(key:string,status:FarmCommandStatus,ar:boolean){if(status==='no_data')return ar?'لا توجد بيانات كافية للحكم.':'There is not enough data yet.';if(status==='good')return ar?'لا يوجد تنبيه حالي في هذا السجل.':'No current alert in this record.';if(status==='critical')return ar?'يوجد سجل عاجل يحتاج مراجعة الآن.':'A critical record needs review now.';return key==='irrigationRecords'?(ar?'نمط تسجيل الري يحتاج مراجعة، وليس تشخيصًا لحالة النبات.':'The irrigation recording pattern needs review, not a plant diagnosis.'):(ar?'يوجد عنصر مسجل يحتاج انتباهك.':'A recorded item needs your attention.')}

const styles=StyleSheet.create({
  page:{width:'100%',maxWidth:680,alignSelf:'center',padding:spacing.lg,paddingBottom:100,gap:spacing.lg},heading:{alignItems:'center',gap:spacing.sm},headingCopy:{flex:1,minWidth:0},date:{...typography.caption,color:colors.primary,marginBottom:2},title:{...typography.page,color:colors.text},farmRail:{gap:spacing.sm},farmChoice:{minHeight:38,maxWidth:220,paddingHorizontal:spacing.md,borderRadius:radius.pill,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},farmChoiceActive:{backgroundColor:colors.primary},farmChoiceText:{...typography.button,color:colors.text},farmChoiceTextActive:{color:colors.surface},
  brief:{backgroundColor:colors.primaryDark,borderRadius:radius.md,padding:spacing.xl,gap:spacing.md},briefEyebrow:{...typography.caption,color:'#CEE1D4'},briefTitle:{...typography.section,color:colors.surface},briefFacts:{backgroundColor:'rgba(255,255,255,0.09)',borderRadius:radius.sm,paddingVertical:spacing.md},briefFact:{flex:1,alignItems:'center',gap:2},briefValue:{...typography.page,color:colors.surface},briefLabel:{...typography.caption,color:'#DCE9E0'},actionList:{gap:spacing.sm},missionRail:{gap:spacing.md},
  statusCta:{minHeight:82,backgroundColor:colors.primarySoft,borderRadius:radius.md,padding:spacing.lg,alignItems:'center',gap:spacing.md},statusIcon:{width:42,height:42,borderRadius:radius.md,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},grow:{flex:1,minWidth:0},statusTitle:{...typography.section,color:colors.primaryDark},quickGrid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},quick:{width:'23%',minWidth:72,minHeight:82,backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.sm,alignItems:'center',justifyContent:'center',gap:spacing.sm},quickText:{...typography.caption,color:colors.text,textAlign:'center'},toolList:{backgroundColor:colors.surface,borderRadius:radius.md,paddingHorizontal:spacing.md},toolRow:{minHeight:58,alignItems:'center',gap:spacing.md,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},toolTitle:{...typography.button,color:colors.text,flex:1},weather:{flexDirection:'row',gap:spacing.sm,alignItems:'center',padding:spacing.md},
  empty:{minHeight:104,backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.lg,alignItems:'center',justifyContent:'center',gap:spacing.sm},emptyText:{...typography.body,color:colors.muted,textAlign:'center'},unavailable:{minHeight:180,backgroundColor:colors.surface,padding:spacing.xl,borderRadius:radius.md,alignItems:'center',justifyContent:'center',gap:spacing.md},unavailableTitle:{...typography.section,color:colors.text,textAlign:'center'},gate:{flex:1,width:'100%',maxWidth:440,alignSelf:'center',justifyContent:'center',padding:spacing.xl,gap:spacing.md},gateIcon:{width:62,height:62,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},gateTitle:{...typography.page,color:colors.text,textAlign:'center'},gateBody:{...typography.body,color:colors.muted,textAlign:'center'},
  scrim:{flex:1,backgroundColor:colors.overlay,justifyContent:'flex-end'},sheet:{width:'100%',maxWidth:680,maxHeight:'82%',alignSelf:'center',backgroundColor:colors.background,padding:spacing.lg,gap:spacing.md},sheetTop:{alignItems:'center',gap:spacing.sm},sheetTitle:{...typography.page,color:colors.text},
});
