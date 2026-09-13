import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AccountField, AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { ChoiceGrid, DataBadge, ResultPanel, SourcePanel, StepProgress, TransparencyNote, smartUI } from '@/components/farm/SmartFarmUI';
import { useFarm } from '@/contexts/FarmContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { smartFarmService } from '@/services/smartFarm';
import type { CropKnowledgeProfile, CropPlan } from '@/types/farm';

const systems=[{value:'open_field',ar:'حقل مفتوح',en:'Open field'},{value:'greenhouse',ar:'بيت محمي',en:'Greenhouse'},{value:'shade_house',ar:'بيت شبكي',en:'Shade house'},{value:'home_garden',ar:'حديقة منزلية',en:'Home garden'}];
const methods=[{value:'direct_seed',ar:'زراعة مباشرة',en:'Direct seed'},{value:'transplant',ar:'شتلات',en:'Transplant'},{value:'container',ar:'أصص أو حاويات',en:'Containers'}];

export default function CropPlanner(){
  const params=useLocalSearchParams<{farmId?:string}>(),{dashboard}=useFarm(),{language,isRTL}=useLanguage(),ar=language==='ar';
  const [step,setStep]=useState(1),[farmId,setFarmId]=useState(params.farmId||dashboard?.farms[0]?.id||''),[crops,setCrops]=useState<CropKnowledgeProfile[]>([]),[cropId,setCropId]=useState(''),[cropDetail,setCropDetail]=useState<CropKnowledgeProfile|null>(null),[system,setSystem]=useState('open_field'),[method,setMethod]=useState('direct_seed'),[plantingDate,setPlantingDate]=useState(new Date().toISOString().slice(0,10)),[area,setArea]=useState(''),[spacingId,setSpacingId]=useState(''),[plan,setPlan]=useState<CropPlan|null>(null),[generatedTasks,setGeneratedTasks]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{smartFarmService.crops().then(setCrops).catch(()=>setError(ar?'تعذر تحميل بيانات المحاصيل.':'Could not load crop data.'));},[ar]);
  useEffect(()=>{const selected=crops.find(item=>item.id===cropId);if(!selected){setCropDetail(null);setSpacingId('');return;}smartFarmService.crop(selected.slug).then(detail=>{setCropDetail(detail);setSpacingId(detail.spacingProfiles?.find(item=>item.productionSystem===system&&item.plantingMethod===method)?.id||'');}).catch(()=>setCropDetail(selected));},[cropId,crops,system,method]);
  const next=()=>{if((step===1&&!farmId)||(step===2&&!cropId)||(step===4&&(!plantingDate||Number(area)<=0))){setError(ar?'أكمل البيانات المطلوبة للمتابعة.':'Complete the required details to continue.');return;}setError('');setStep(value=>value+1);};
  const save=async()=>{setBusy(true);setError('');try{const response=await smartFarmService.createPlan({farmId,cropProfileId:cropId,spacingProfileId:spacingId||undefined,plantingDate,areaM2:Number(area),productionSystem:system,plantingMethod:method});setGeneratedTasks(response.generatedTasks);setPlan(response.plan);}catch{setError(ar?'تعذر حفظ الخطة. تأكد أن بيانات المحصول منشورة وموثّقة.':'Could not save the plan. Make sure the crop data is published and verified.');}finally{setBusy(false);}};
  const spacing=cropDetail?.spacingProfiles?.find(item=>item.id===spacingId);
  if(!dashboard?.farms.length)return <AccountPage title={ar?'مخطط المحصول':'Crop planner'}><Notice text={ar?'أضف مزرعة أولاً لربط الخطة ببياناتك.':'Add a farm first so the plan belongs to your records.'}/><AppButton label={ar?'إعداد مزرعتي':'Set up My Farm'} onPress={()=>router.replace('/my-farm/setup')}/></AccountPage>;
  if(plan)return <AccountPage title={ar?'تم حفظ الخطة':'Plan saved'}><ResultPanel title={ar?'المحصول المخطط':'Planned crop'} value={ar?(plan.crop?.nameAr||''):(plan.crop?.nameEn||'')} detail={`${plan.areaM2} m² · ${plan.plantingDate}`} kind="verified"/>{'plantCount'in plan.calculation?<ResultPanel title={ar?'العدد التقديري':'Estimated population'} value={new Intl.NumberFormat(ar?'ar-AE':'en-AE').format(plan.calculation.plantCount)}/>:<ResultPanel title={ar?'عدد النباتات':'Plant population'} value={ar?'غير متاح بدون ملف مسافات موثّق':'Unavailable without verified spacing'} kind="unavailable"/>}<ResultPanel title={ar?'المهام التلقائية':'Automatic tasks'} value={generatedTasks?new Intl.NumberFormat(ar?'ar-AE':'en-AE').format(generatedTasks):(ar?'لا توجد قوالب موثّقة':'No verified templates')} kind={generatedTasks?'verified':'unavailable'}/><TransparencyNote>{generatedTasks?(ar?'أُنشئت المهام من قوالب موثّقة مرتبطة بالمحصول والخطة.':'Tasks were generated from verified templates linked to this crop and plan.'):(ar?'تم حفظ الخطة ودورة المحصول، ولم يخمّن النظام أي مهام أو مواعيد.':'The plan and crop cycle were saved; no tasks or dates were guessed.')}</TransparencyNote><AppButton label={ar?'العودة إلى مزرعتي':'Back to My Farm'} onPress={()=>router.replace('/my-farm')}/></AccountPage>;
  return (
    <AccountPage title={ar ? 'مخطط المحصول' : 'Crop planner'}>
      <StepProgress step={step} total={5} />
      {step === 1 ? (
        <>
          <Text style={[smartUI.question, { textAlign: isRTL ? 'right' : 'left' }]}>{ar ? 'اختر المزرعة' : 'Choose a farm'}</Text>
          <ChoiceGrid items={dashboard.farms.map(item => ({ value: item.id, ar: item.name, en: item.name }))} value={farmId} onChange={setFarmId} />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Text style={[smartUI.question, { textAlign: isRTL ? 'right' : 'left' }]}>{ar ? 'ماذا تريد أن تزرع؟' : 'What do you want to plant?'}</Text>
          {crops.length ? (
            <ChoiceGrid items={crops.map(item => ({ value: item.id, ar: item.nameAr, en: item.nameEn }))} value={cropId} onChange={setCropId} />
          ) : (
            <>
              <DataBadge kind="unavailable" />
              <Notice text={ar ? 'لا توجد ملفات محاصيل موثّقة منشورة الآن. افتح المكتبة لمراجعة حالة المحتوى.' : 'No verified crop profiles are published yet. Open the library to review available content.'} />
              <AppButton secondary label={ar ? 'فتح المكتبة' : 'Open library'} onPress={() => router.push('/my-farm/library')} />
            </>
          )}
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Text style={[smartUI.question, { textAlign: isRTL ? 'right' : 'left' }]}>{ar ? 'كيف ستزرع؟' : 'How will you grow it?'}</Text>
          <ChoiceGrid items={systems} value={system} onChange={setSystem} />
          <ChoiceGrid items={methods} value={method} onChange={setMethod} />
        </>
      ) : null}
      {step === 4 ? (
        <>
          <Text style={[smartUI.question, { textAlign: isRTL ? 'right' : 'left' }]}>{ar ? 'متى وما المساحة؟' : 'When and how much area?'}</Text>
          <AccountField label={ar ? 'تاريخ الزراعة' : 'Planting date'} value={plantingDate} onChangeText={setPlantingDate} placeholder="YYYY-MM-DD" ltr />
          <AccountField label={ar ? 'المساحة بالمتر المربع' : 'Area (m²)'} value={area} onChangeText={setArea} keyboardType="decimal-pad" ltr />
          <DataBadge kind="user" />
        </>
      ) : null}
      {step === 5 ? (
        <>
          <Text style={[smartUI.question, { textAlign: isRTL ? 'right' : 'left' }]}>{ar ? 'المسافات والحساب' : 'Spacing and calculation'}</Text>
          {cropDetail?.spacingProfiles?.length ? (
            <ChoiceGrid items={cropDetail.spacingProfiles.filter(item => item.productionSystem === system).map(item => ({ value: item.id, ar: `${item.rowSpacingCm} × ${item.plantSpacingCm} سم`, en: `${item.rowSpacingCm} × ${item.plantSpacingCm} cm` }))} value={spacingId} onChange={setSpacingId} />
          ) : (
            <ResultPanel title={ar ? 'ملف المسافات' : 'Spacing profile'} value={ar ? 'غير متاح لهذا النظام' : 'Unavailable for this system'} kind="unavailable" />
          )}
          {spacing ? <SourcePanel source={spacing.source} /> : null}
          <TransparencyNote>{ar ? 'يمكن حفظ الخطة بدون مسافات، لكن التطبيق لن يخمّن عدد النباتات أو يولّد مهام تلقائية.' : 'You can save without spacing, but the app will not guess plant population or generate tasks.'}</TransparencyNote>
        </>
      ) : null}
      {error ? <Notice error text={error} /> : null}
      <View style={smartUI.actions}>
        {step < 5 ? (
          <AppButton disabled={step === 2 && !crops.length} label={ar ? 'متابعة' : 'Continue'} arrow onPress={next} />
        ) : (
          <AppButton disabled={busy} label={busy ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ الخطة' : 'Save plan')} onPress={save} />
        )}
        {step > 1 ? <AppButton secondary label={ar ? 'رجوع' : 'Back'} onPress={() => { setError(''); setStep(value => value - 1); }} /> : null}
      </View>
    </AccountPage>
  );
}
