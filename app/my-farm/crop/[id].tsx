import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  CalendarClock,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Droplets,
  Images,
  Leaf,
  ListTodo,
  NotebookPen,
  Sprout,
  TrendingUp,
} from 'lucide-react-native';
import { AccountField, AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { MotionPressable } from '@/components/Motion';
import { FarmRow, FarmSection, FarmSkeleton, farmUI } from '@/components/farm/FarmUI';
import { FarmStatusPill } from '@/components/farm/FarmCommandUI';
import { useFarm } from '@/contexts/FarmContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { farmCommandService } from '@/services/farmCommand';
import { farmService } from '@/services/farm';
import { CustomerServiceError } from '@/services/apiClient';
import type { CommandTimelineEvent, CropMissionResponse, GrowthStage, SeasonFarmReport } from '@/types/farm';

const stageOptions:Array<{value:GrowthStage;ar:string;en:string}> = [
  {value:'seedling',ar:'شتلة',en:'Seedling'}, {value:'vegetative',ar:'نمو خضري',en:'Vegetative'},
  {value:'flowering',ar:'إزهار',en:'Flowering'}, {value:'fruit_set',ar:'عقد',en:'Fruit set'},
  {value:'production',ar:'إنتاج',en:'Production'}, {value:'harvest',ar:'حصاد',en:'Harvest'},
  {value:'finished',ar:'منتهية',en:'Finished'},
];

export default function CropCommandScreen() {
  const { id = '', section } = useLocalSearchParams<{id:string;section?:string}>();
  const { language,isRTL } = useLanguage();
  const { submit,refresh:refreshFarm } = useFarm();
  const ar = language === 'ar';
  const [data,setData] = useState<CropMissionResponse|null>(null);
  const [timeline,setTimeline] = useState<CommandTimelineEvent[]>([]);
  const [season,setSeason] = useState<SeasonFarmReport|null>(null);
  const [answers,setAnswers] = useState<Record<string,string>>({});
  const [checkInNotes,setCheckInNotes] = useState('');
  const [stage,setStage] = useState<GrowthStage>('seedling');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState('');
  const [notice,setNotice] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotice('');
    try {
      const [mission,events,report] = await Promise.all([
        farmCommandService.mission(id),
        farmCommandService.timeline(id),
        farmCommandService.seasonReport(id),
      ]);
      setData(mission);
      setTimeline(events);
      setSeason(report.report);
      setAnswers(mission.todayCheckIn?.answers || {});
      setCheckInNotes(mission.todayCheckIn?.notes || '');
      setStage(mission.mission.stage.expected?.key || mission.mission.crop.growthStage);
    } catch {
      setNotice(ar ? 'تعذر تحميل مركز تحكم المحصول.' : 'Could not load the crop command center.');
    } finally {
      setLoading(false);
    }
  },[id,ar]);
  useEffect(() => { void load(); },[load]);

  const mission = data?.mission;
  const grouped = useMemo(() => ({
    operations: timeline.filter((item) => item.eventType === 'operation_recorded'),
    notes: timeline.filter((item) => item.eventType === 'note_added'),
  }),[timeline]);

  const checkIn = async () => {
    if (!data) return;
    const missing = data.checkInQuestions.some((question) => !answers[question.key]);
    if (missing) return setNotice(ar ? 'أجب عن أسئلة المتابعة الظاهرة أولاً.' : 'Answer the visible check-in questions first.');
    setBusy('checkin'); setNotice('');
    try {
      const result = await submit('checkin',{cropId:id,answers,notes:checkInNotes,date:new Date().toISOString().slice(0,10)});
      setNotice(result === 'queued' ? (ar ? 'حُفظت المتابعة للمزامنة عند عودة الاتصال.' : 'Check-in saved for sync when online.') : (ar ? 'تم حفظ متابعة اليوم.' : 'Today\'s check-in was saved.'));
      if (result === 'saved') await load();
    } catch { setNotice(ar ? 'تعذر حفظ المتابعة.' : 'Could not save the check-in.'); }
    finally { setBusy(''); }
  };

  const confirmStage = async () => {
    setBusy('stage'); setNotice('');
    try {
      const result = await submit('stage_confirmation',{cropId:id,stageKey:stage,confirmedAt:new Date().toISOString()});
      setNotice(result === 'queued' ? (ar ? 'حُفظ التأكيد للمزامنة.' : 'Stage confirmation saved for sync.') : (ar ? 'تم تأكيد المرحلة وتحديث المهام المستقبلية الموثقة فقط.' : 'Stage confirmed; only future verified tasks were adjusted.'));
      if (result === 'saved') await Promise.all([load(),refreshFarm()]);
    } catch { setNotice(ar ? 'تعذر تأكيد المرحلة.' : 'Could not confirm the stage.'); }
    finally { setBusy(''); }
  };

  const completeCrop = async () => {
    if (!mission) return;
    setBusy('complete'); setNotice('');
    try {
      await farmService.completeCrop(mission.crop.id,new Date().toISOString().slice(0,10));
      await Promise.all([load(),refreshFarm()]);
      setNotice(ar ? 'تم إنهاء الدورة وحفظ تقرير الموسم.' : 'The crop cycle was completed and its season report saved.');
    } catch { setNotice(ar ? 'تعذر إنهاء الدورة.' : 'Could not complete the crop cycle.'); }
    finally { setBusy(''); }
  };

  const addPhoto = async () => {
    if (!mission) return;
    setNotice('');
    try {
      await farmService.uploadMedia({farmId:mission.farm.id,zoneId:mission.zone?.id,cropCycleId:mission.id,type:'crop'});
      await load();
    } catch (error) {
      setNotice(error instanceof CustomerServiceError&&error.code==='farm_media_storage_not_configured'?(ar?'رفع الصور يحتاج تهيئة Object Storage. لم يتم ادعاء حفظ الصورة.':'Photo upload needs object storage configuration. No upload was claimed.'):(ar?'تعذر تجهيز رفع الصورة.':'Could not prepare the photo upload.'));
    }
  };

  if (loading && !mission) return <AccountPage title={ar?'المحصول':'Crop'}><FarmSkeleton/><FarmSkeleton/></AccountPage>;
  if (!mission) return <AccountPage title={ar?'المحصول':'Crop'}><Notice error text={notice || (ar?'المحصول غير متاح.':'Crop unavailable.')}/><AppButton secondary label={ar?'رجوع إلى مزرعتي':'Back to My Farm'} onPress={()=>router.replace('/my-farm')}/></AccountPage>;

  const route = (type:string) => router.push({pathname:'/my-farm/add',params:{type,farmId:mission.farm.id,zoneId:mission.zone?.id||'',cropId:mission.id}});
  const expected = mission.stage.expected;
  const confirmed = mission.stage.confirmed;
  return <AccountPage title={mission.crop.cropName}>
    <View style={styles.hero}>
      <View style={[styles.heroTop,{flexDirection:isRTL?'row-reverse':'row'}]}><View style={styles.heroIcon}><Leaf size={24} color={colors.primary}/></View><View style={styles.grow}><Text style={[styles.heroTitle,{textAlign:isRTL?'right':'left'}]}>{mission.crop.cropName}</Text><Text style={[styles.heroMeta,{textAlign:isRTL?'right':'left'}]}>{[mission.farm.name,mission.zone?.name,mission.crop.variety].filter(Boolean).join(' · ')}</Text></View><FarmStatusPill status={mission.status}/></View>
      <View style={[styles.heroFacts,{flexDirection:isRTL?'row-reverse':'row'}]}><MiniFact label={ar?'العمر':'Age'} value={mission.ageDays===null?(ar?'غير معروف':'Unknown'):(ar?`${mission.ageDays} يوم`:`${mission.ageDays} days`)}/><MiniFact label={ar?'المرحلة':'Stage'} value={confirmed?stageName(confirmed.key,ar):(expected?(ar?expected.nameAr:expected.nameEn):(ar?'غير مؤكدة':'Unconfirmed'))}/></View>
    </View>
    {notice?<Notice text={notice}/>:null}

    <FarmSection title={ar?'اليوم':'Today'}>
      {data.checkInQuestions.map((question)=><View key={question.key} style={styles.question}><Text style={[styles.questionTitle,{textAlign:isRTL?'right':'left'}]}>{ar?question.ar:question.en}</Text><View style={[styles.options,{flexDirection:isRTL?'row-reverse':'row'}]}>{question.options.map((option)=><Choice key={option} active={answers[question.key]===option} label={optionLabel(option,ar)} onPress={()=>setAnswers((current)=>({...current,[question.key]:option}))}/>)}</View></View>)}
      <AccountField label={ar?'ملاحظة قصيرة':'Short note'} value={checkInNotes} onChangeText={setCheckInNotes} multiline/>
      <AppButton disabled={busy==='checkin'} label={data.todayCheckIn?(ar?'تحديث متابعة اليوم':'Update today\'s check-in'):(ar?'حفظ متابعة اليوم':'Save today\'s check-in')} onPress={checkIn}/>
    </FarmSection>

    <FarmSection title={ar?'المرحلة الحالية':'Current stage'}>
      <View style={farmUI.card}>
        <FarmRow icon={Sprout} title={confirmed?(ar?`مؤكدة: ${stageName(confirmed.key,true)}`:`Confirmed: ${stageName(confirmed.key,false)}`):(ar?'لم تؤكد المرحلة الفعلية بعد':'Actual stage has not been confirmed')} body={confirmed?formatDate(confirmed.confirmedAt,ar):(expected?(ar?`المتوقع من مصدر موثق: ${expected.nameAr}`:`Verified expectation: ${expected.nameEn}`):(ar?'لا توجد بيانات نمو موثقة لهذا المحصول.':'No verified growth profile is available for this crop.'))}/>
        <View style={[styles.options,{flexDirection:isRTL?'row-reverse':'row'}]}>{stageOptions.map((item)=><Choice key={item.value} active={stage===item.value} label={ar?item.ar:item.en} onPress={()=>setStage(item.value)}/>)}</View>
        <Notice text={mission.stage.verifiedGuidanceAvailable?(ar?'التأكيد يكيّف المهام المستقبلية المولدة من المصدر الموثق فقط، ولا يغيّر السجلات المكتملة.':'Confirmation adjusts future system tasks backed by verified guidance only; completed records stay unchanged.'):(ar?'سيُحفظ تأكيدك كسجل فعلي، بدون إنشاء جدول إرشادي غير موثق.':'Your confirmation is stored as an actual record without inventing an unverified schedule.')}/>
        <AppButton secondary disabled={busy==='stage'} label={ar?'تأكيد المرحلة الفعلية':'Confirm actual stage'} onPress={confirmStage}/>
      </View>
    </FarmSection>

    <FarmSection title={ar?'المعلم القادم':'Next milestone'}>
      {mission.stage.next?<FarmRow icon={CalendarClock} title={ar?mission.stage.next.nameAr:mission.stage.next.nameEn} body={mission.stage.next.expectedAt?formatDate(mission.stage.next.expectedAt,ar):(ar?'موعد تقريبي من ملف نمو موثق':'Estimated from a verified growth profile')}/>:<QuietLine icon={CalendarClock} text={ar?'لا يوجد معلم موثق تالٍ حاليًا.':'No next verified milestone is available.'}/>}
    </FarmSection>

    <FarmSection title={ar?'الري':'Irrigation'} action={ar?'تسجيل ري':'Record'} onAction={()=>route('irrigation')}>
      <FarmRow icon={Droplets} title={ar?mission.irrigation.observationAr:mission.irrigation.observationEn} body={mission.irrigation.lastRecordedAt?(ar?`آخر سجل: ${formatDate(mission.irrigation.lastRecordedAt,ar)}`:`Last record: ${formatDate(mission.irrigation.lastRecordedAt,ar)}`):(ar?'لا توجد سجلات كافية.':'Not enough records.')}/>
      <Notice text={ar?'هذا تحليل لفجوة تسجيل الري فقط، وليس تشخيصًا لعطش النبات أو توصية بكمية مياه.':'This detects irrigation recording gaps only. It is not a plant dehydration diagnosis or a water-volume recommendation.'}/>
    </FarmSection>

    <FarmSection title={ar?'المهام':'Tasks'} action={ar?'إضافة':'Add'} onAction={()=>route('task')}>
      {mission.upcomingTask?<FarmRow icon={ListTodo} title={mission.upcomingTask.title} body={formatDate(mission.upcomingTask.dueAt,ar)}/>:<QuietLine icon={CheckCircle2} text={ar?'لا توجد مهمة قادمة مسجلة.':'No upcoming task is recorded.'}/>}
    </FarmSection>

    <FarmSection title={ar?'المشاكل':'Problems'} action={ar?'إبلاغ':'Report'} onAction={()=>route('problem')}>
      {mission.openProblems.length?<View style={farmUI.card}>{mission.openProblems.map((problem)=><FarmRow key={problem.id} icon={AlertTriangle} title={problem.title} body={`${problem.severity} · ${problem.status.replace('_',' ')}`} onPress={()=>router.push({pathname:'/my-farm/problem/[id]',params:{id:problem.id}})}/>)}</View>:<QuietLine icon={CheckCircle2} text={ar?'لا توجد مشاكل مفتوحة مسجلة.':'No open problems are recorded.'}/>}
    </FarmSection>

    <FarmSection title={ar?'العمليات':'Operations'} action={ar?'تسجيل':'Record'} onAction={()=>route('operation')}>
      {grouped.operations.length?<View style={farmUI.card}>{grouped.operations.slice(0,3).map((event)=><TimelineRow key={event.id} event={event} ar={ar}/>)}</View>:<QuietLine icon={NotebookPen} text={ar?'لا توجد عمليات مسجلة بعد.':'No operations have been recorded yet.'}/>}
    </FarmSection>

    <FarmSection title={ar?'الصور':'Photos'} action={ar?'إضافة':'Add'} onAction={addPhoto}>
      {mission.photos.length?<View style={farmUI.card}>{mission.photos.slice(0,4).map((photo)=><FarmRow key={photo.id} icon={Images} title={photo.notes||(ar?'صورة محصول':'Crop photo')} body={formatDate(photo.capturedAt,ar)}/>)}</View>:<QuietLine icon={Camera} text={section==='photos'?(ar?'رفع الصور يحتاج تهيئة Object Storage. لن يدعي التطبيق رفع صورة قبل ذلك.':'Photo upload needs object storage configuration. The app will not claim an upload before then.'):(ar?'لا توجد صور محفوظة لهذا المحصول.':'No photos are stored for this crop.')}/>}
    </FarmSection>

    <FarmSection title={ar?'الحصاد':'Harvest'} action={ar?'تسجيل':'Record'} onAction={()=>route('harvest')}>
      {mission.harvest.status.expectedAt?<FarmRow icon={CalendarClock} title={ar?'موعد مرحلة الحصاد المتوقع من ملف موثق':'Verified expected harvest stage'} body={formatDate(mission.harvest.status.expectedAt,ar)}/>:null}
      {mission.harvest.status.actualStart?<FarmRow icon={CheckCircle2} title={ar?'بداية الحصاد الفعلية':'Actual harvest start'} body={formatDate(mission.harvest.status.actualStart,ar)}/>:null}
      {mission.harvest.totals.length?<View style={farmUI.card}>{mission.harvest.totals.map((total)=><FarmRow key={total.unit} icon={Sprout} title={`${total.quantity} ${total.unit}`} body={ar?`${total.events} سجلات · متوسط ${(total.quantity/total.events).toFixed(2)} لكل سجل`:`${total.events} record(s) · ${(total.quantity/total.events).toFixed(2)} average per event`}/>)}</View>:<QuietLine icon={Sprout} text={ar?'لا توجد كميات حصاد مسجلة.':'No harvest quantities are recorded.'}/>}
      {season?.yieldPerM2Kg!==null&&season?.yieldPerM2Kg!==undefined?<Notice text={ar?`إنتاجية محسوبة من الحصاد والمساحة المسجلين: ${season.yieldPerM2Kg} كجم/م²`:`Calculated from recorded harvest and area: ${season.yieldPerM2Kg} kg/m²`}/>:null}
    </FarmSection>

    <FarmSection title={ar?'المصروفات والمبيعات':'Expenses and sales'} action={ar?'فتح':'Open'} onAction={()=>router.push({pathname:'/my-farm/finance',params:{farmId:mission.farm.id,cropId:mission.id}})}>
      <View style={[styles.moneyRow,{flexDirection:isRTL?'row-reverse':'row'}]}><MoneyFact label={ar?'مصروفات':'Expenses'} amount={mission.financials.totalCostMinor} currency={mission.financials.currency}/><MoneyFact label={ar?'مبيعات':'Sales'} amount={mission.financials.totalRevenueMinor} currency={mission.financials.currency}/><MoneyFact label={ar?'هامش إجمالي':'Gross margin'} amount={mission.financials.grossMarginMinor} currency={mission.financials.currency}/></View>
    </FarmSection>

    <FarmSection title={ar?'الملاحظات':'Notes'} action={ar?'إضافة':'Add'} onAction={()=>route('note')}>
      {grouped.notes.length?<View style={farmUI.card}>{grouped.notes.slice(0,3).map((event)=><TimelineRow key={event.id} event={event} ar={ar}/>)}</View>:<QuietLine icon={NotebookPen} text={ar?'لا توجد ملاحظات مسجلة.':'No notes have been recorded.'}/>}
    </FarmSection>

    <FarmSection title={ar?'المتجر المرتبط بالسياق':'Contextual store'}>
      <Notice text={ar?'نتائج المتجر تعتمد على اسم المحصول للملاءمة التجارية فقط، وليست توصية زراعية أو وصفة علاج.':'Store results use the crop name for shopping relevance only, not as an agronomic or treatment recommendation.'}/>
      <AppButton secondary label={ar?`ابحث عن مستلزمات ${mission.crop.cropName}`:`Search supplies for ${mission.crop.cropName}`} onPress={()=>router.push({pathname:'/(tabs)/search',params:{q:mission.crop.cropName}})}/>
    </FarmSection>

    <FarmSection title={ar?'السجل الزمني':'Timeline'}>
      {timeline.length?<View style={farmUI.card}>{timeline.slice(0,12).map((event)=><TimelineRow key={event.id} event={event} ar={ar}/>)}</View>:<QuietLine icon={Clock3} text={ar?'سيظهر تاريخ المحصول هنا بعد أول سجل.':'The crop history will appear after the first record.'}/>}
    </FarmSection>

    {season?<FarmSection title={ar?'تقرير الموسم':'Season report'}>
      <View style={[styles.moneyRow,{flexDirection:isRTL?'row-reverse':'row'}]}><MiniFact label={ar?'سجلات الري':'Irrigation'} value={String(season.irrigationRecords)}/><MiniFact label={ar?'المشاكل':'Problems'} value={String(season.problems)}/><MiniFact label={ar?'مدة الموسم':'Duration'} value={season.seasonDurationDays===null?'—':(ar?`${season.seasonDurationDays} يوم`:`${season.seasonDurationDays} days`)}/></View>
      <Notice text={mission.crop.status==='completed'?(ar?'تقرير الموسم محفوظ من سجلات المزرعة الفعلية.':'The season report is stored from actual farm records.'):(ar?'هذه معاينة حية. سيُحفظ التقرير عند إنهاء دورة المحصول.':'This is a live preview. The report is stored when the crop cycle is completed.')}/>
    </FarmSection>:null}

    <AppButton secondary label={ar?'اسأل مساعد MIG FARM مع سياق المحصول':'Ask MIG FARM Assistant with crop context'} onPress={()=>router.push({pathname:'/(tabs)/assistant',params:{farm:JSON.stringify({crop:mission.crop.cropName,growthStage:confirmed?.key||mission.crop.growthStage,openProblems:mission.openProblems.length})}})}/>
    {mission.crop.status!=='completed'?<AppButton secondary disabled={busy==='complete'} label={ar?'إنهاء دورة المحصول':'Complete crop cycle'} onPress={completeCrop}/>:null}
  </AccountPage>;
}

function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}) { return <MotionPressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.choice,active&&styles.choiceActive]}><Text style={[styles.choiceText,active&&styles.choiceTextActive]}>{label}</Text></MotionPressable>; }
function MiniFact({label,value}:{label:string;value:string}) { return <View style={styles.miniFact}><Text numberOfLines={1} style={styles.miniLabel}>{label}</Text><Text numberOfLines={2} style={styles.miniValue}>{value}</Text></View>; }
function MoneyFact({label,amount,currency}:{label:string;amount:number;currency:string}) { return <View style={styles.moneyFact}><Text style={styles.miniLabel}>{label}</Text><Text numberOfLines={1} style={styles.moneyValue}>{(amount/100).toFixed(2)} {currency}</Text></View>; }
function QuietLine({icon:Icon,text}:{icon:typeof Clock3;text:string}) { return <View style={styles.quiet}><Icon size={20} color={colors.primary}/><Text style={styles.quietText}>{text}</Text></View>; }
function TimelineRow({event,ar}:{event:CommandTimelineEvent;ar:boolean}) { const info=eventLabel(event,ar); return <FarmRow icon={info.icon} title={info.title} body={formatDate(event.eventAt,ar)}/>; }
function stageName(value:GrowthStage,ar:boolean) { return stageOptions.find((item)=>item.value===value)?.[ar?'ar':'en'] || value; }
function optionLabel(value:string,ar:boolean) { const labels:Record<string,{ar:string;en:string}>={yes:{ar:'نعم',en:'Yes'},no:{ar:'لا',en:'No'},skip:{ar:'تخطي',en:'Skip'},not_yet:{ar:'ليس بعد',en:'Not yet'}}; return labels[value]?.[ar?'ar':'en']||value; }
function formatDate(value:string,ar:boolean) { return new Intl.DateTimeFormat(ar?'ar-AE':'en-AE',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value)); }
function eventLabel(event:CommandTimelineEvent,ar:boolean):{title:string;icon:typeof Clock3} {
  const payload=event.payload||{};
  const labels:Record<string,{ar:string;en:string;icon:typeof Clock3}>={
    irrigation_recorded:{ar:'تم تسجيل الري',en:'Irrigation recorded',icon:Droplets}, operation_recorded:{ar:'تم تسجيل عملية',en:'Operation recorded',icon:NotebookPen},
    problem_opened:{ar:String(payload.title||'تم تسجيل مشكلة'),en:String(payload.title||'Problem recorded'),icon:AlertTriangle}, problem_updated:{ar:'تمت متابعة مشكلة',en:'Problem followed up',icon:AlertTriangle},
    problem_resolved:{ar:'تم حل مشكلة',en:'Problem resolved',icon:CheckCircle2}, photo_added:{ar:'تمت إضافة صورة',en:'Photo added',icon:Camera},
    harvest_recorded:{ar:`حصاد ${payload.quantity||''} ${payload.unit||''}`.trim(),en:`Harvest ${payload.quantity||''} ${payload.unit||''}`.trim(),icon:Sprout},
    expense_added:{ar:'تم تسجيل مصروف',en:'Expense recorded',icon:CircleDollarSign}, sale_added:{ar:'تم تسجيل بيع',en:'Sale recorded',icon:TrendingUp},
    checkin_recorded:{ar:'تمت المتابعة اليومية',en:'Daily check-in completed',icon:CheckCircle2}, stage_confirmed:{ar:'تم تأكيد مرحلة نمو',en:'Growth stage confirmed',icon:Sprout},
    task_completed:{ar:String(payload.title||'تم إكمال مهمة'),en:String(payload.title||'Task completed'),icon:ListTodo}, note_added:{ar:String(payload.body||'ملاحظة'),en:String(payload.body||'Note'),icon:NotebookPen},
  };
  const item=labels[event.eventType]||{ar:'تحديث سجل المزرعة',en:'Farm record updated',icon:Clock3};
  return {title:ar?item.ar:item.en,icon:item.icon};
}

const styles=StyleSheet.create({
  hero:{backgroundColor:colors.primaryDark,borderRadius:radius.md,padding:spacing.lg,gap:spacing.lg},heroTop:{alignItems:'center',gap:spacing.md},heroIcon:{width:46,height:46,borderRadius:radius.md,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},grow:{flex:1,minWidth:0},heroTitle:{...typography.page,color:colors.surface},heroMeta:{...typography.caption,color:'#DCE9E0',marginTop:2},heroFacts:{backgroundColor:'rgba(255,255,255,0.09)',borderRadius:radius.sm,padding:spacing.sm,gap:spacing.sm},
  miniFact:{flex:1,minWidth:92,gap:2,padding:spacing.sm},miniLabel:{...typography.caption,color:colors.muted},miniValue:{...typography.button,color:colors.text},question:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.md,gap:spacing.sm},questionTitle:{...typography.button,color:colors.text},options:{flexWrap:'wrap',gap:spacing.sm},choice:{minHeight:38,paddingHorizontal:spacing.md,borderRadius:radius.pill,backgroundColor:colors.surfaceMuted,alignItems:'center',justifyContent:'center'},choiceActive:{backgroundColor:colors.primary},choiceText:{...typography.caption,color:colors.text},choiceTextActive:{color:colors.surface},
  quiet:{minHeight:76,backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.lg,flexDirection:'row',alignItems:'center',gap:spacing.md},quietText:{...typography.body,color:colors.muted,flex:1},moneyRow:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.sm,gap:spacing.xs,flexWrap:'wrap'},moneyFact:{flex:1,minWidth:102,padding:spacing.sm,gap:2},moneyValue:{...typography.button,color:colors.primaryDark},
});
