import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { ChoiceGrid, DataBadge, StepProgress, TransparencyNote, smartUI } from '@/components/farm/SmartFarmUI';
import { VerifiedSourceLink } from '@/components/farm/FarmIntelligenceUI';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { smartFarmService } from '@/services/smartFarm';
import { farmIntelligenceService } from '@/services/farmIntelligence';
import type { CropKnowledgeProfile, VerifiedDiagnosisResult } from '@/types/farm';

const parts=[{value:'leaf',ar:'الأوراق',en:'Leaves'},{value:'stem',ar:'الساق',en:'Stem'},{value:'root',ar:'الجذور',en:'Roots'},{value:'fruit',ar:'الثمار',en:'Fruit'}];
const symptoms=[{value:'yellow_angular_spots',ar:'بقع صفراء زاوية',en:'Yellow angular spots'},{value:'white_powdery_growth',ar:'نمو أبيض مسحوقي',en:'White powdery growth'},{value:'stippled_pale_leaves',ar:'تنقيط وشحوب الأوراق',en:'Stippled pale leaves'},{value:'small_brown_spots',ar:'بقع بنية صغيرة',en:'Small brown spots'},{value:'black_sunken_bottom_or_side',ar:'سواد غائر في الثمرة',en:'Black sunken fruit area'},{value:'tan_white_exposed_side',ar:'جانب فاتح مكشوف بالثمرة',en:'Pale exposed fruit side'}];
const spreads=[{value:'single',ar:'نبات واحد',en:'One plant'},{value:'patches',ar:'بقع متفرقة',en:'Patches'},{value:'widespread',ar:'منتشرة',en:'Widespread'}];

export default function GuidedDiagnosis(){
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  const [step,setStep]=useState(1),[crops,setCrops]=useState<CropKnowledgeProfile[]>([]),[crop,setCrop]=useState(''),[part,setPart]=useState('leaf'),[symptom,setSymptom]=useState('yellow_angular_spots'),[spread,setSpread]=useState('single'),[result,setResult]=useState<VerifiedDiagnosisResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{smartFarmService.crops().then(setCrops).catch(()=>setCrops([]));},[]);
  const run=async()=>{setBusy(true);setError('');try{setResult(await farmIntelligenceService.diagnose({cropSlug:crop||undefined,plantPart:part,symptoms:[symptom],spread}));setStep(5);}catch{setError(ar?'تعذر فحص قاعدة المعرفة الآن.':'The knowledge base could not be checked.');}finally{setBusy(false);}};
  const cropChoices=[{value:'',ar:'غير محدد',en:'Not specified'},...crops.map(item=>({value:item.slug,ar:item.nameAr,en:item.nameEn}))];
  return (
    <AccountPage title={ar ? 'تشخيص إرشادي' : 'Guided diagnosis'}>
      <StepProgress step={step} total={5} />
      {step === 1 ? (
        <>
          <Text style={[smartUI.question, { textAlign: isRTL ? 'right' : 'left' }]}>{ar ? 'ما المحصول؟' : 'Which crop?'}</Text>
          <ChoiceGrid items={cropChoices} value={crop} onChange={setCrop} />
          {!crops.length ? <Notice text={ar ? 'لا توجد ملفات محاصيل موثّقة منشورة؛ يمكنك المتابعة بدون تحديد المحصول.' : 'No verified crop profiles are published; you can continue without selecting a crop.'} /> : null}
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Text style={[smartUI.question, { textAlign: isRTL ? 'right' : 'left' }]}>{ar ? 'أين ظهرت العلامة؟' : 'Where is the sign visible?'}</Text>
          <ChoiceGrid items={parts} value={part} onChange={setPart} />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Text style={[smartUI.question, { textAlign: isRTL ? 'right' : 'left' }]}>{ar ? 'ما العلامة الأساسية؟' : 'What is the main sign?'}</Text>
          <ChoiceGrid items={symptoms} value={symptom} onChange={setSymptom} />
        </>
      ) : null}
      {step === 4 ? (
        <>
          <Text style={[smartUI.question, { textAlign: isRTL ? 'right' : 'left' }]}>{ar ? 'كيف تنتشر؟' : 'How is it spreading?'}</Text>
          <ChoiceGrid items={spreads} value={spread} onChange={setSpread} />
          <TransparencyNote>{ar ? 'لن نعرض اسم مبيد أو علاج من التخمين. النتيجة تعرض احتمالات فحص موثّقة فقط.' : 'No pesticide or treatment is guessed. Results show only verified inspection possibilities.'}</TransparencyNote>
        </>
      ) : null}
      {step === 5 && result ? <DiagnosisResult result={result} ar={ar} rtl={isRTL} /> : null}
      {error ? <Notice error text={error} /> : null}
      <View style={smartUI.actions}>
        {step < 4 ? (
          <AppButton label={ar ? 'متابعة' : 'Continue'} arrow onPress={() => setStep(value => value + 1)} />
        ) : step === 4 ? (
          <AppButton disabled={busy} label={busy ? (ar ? 'جارٍ الفحص...' : 'Checking...') : (ar ? 'راجع قاعدة المعرفة' : 'Check knowledge base')} onPress={run} />
        ) : (
          <AppButton label={ar ? 'اسأل مهندس MIG FARM' : 'Ask MIG FARM engineer'} onPress={() => router.push('/(tabs)/assistant')} />
        )}
        {step > 1 && step < 5 ? <AppButton secondary label={ar ? 'رجوع' : 'Back'} onPress={() => setStep(value => value - 1)} /> : null}
      </View>
    </AccountPage>
  );
}
function DiagnosisResult({result,ar,rtl}:{result:VerifiedDiagnosisResult;ar:boolean;rtl:boolean}){return <View style={styles.results}><DataBadge kind={result.possibleCauses.length?'verified':'unavailable'}/><Text style={[styles.title,{textAlign:rtl?'right':'left'}]}>{result.possibleCauses.length?(ar?'احتمالات تحتاج فحصًا':'Possibilities to inspect'):(ar?'لا توجد مطابقة موثقة':'No verified match')}</Text>{result.possibleCauses.map((item,index)=><View key={`${item.causeType}-${index}`} style={styles.result}><Text style={[styles.cause,{textAlign:rtl?'right':'left'}]}>{ar?item.possibleCauseAr:item.possibleCauseEn}</Text>{(ar?item.inspectionChecksAr:item.inspectionChecksEn).map(check=><Text key={check} style={[styles.check,{textAlign:rtl?'right':'left'}]}>• {check}</Text>)}{item.source?<VerifiedSourceLink source={item.source}/>:null}</View>)}<TransparencyNote>{ar?result.disclaimerAr:result.disclaimerEn}</TransparencyNote></View>}
const styles=StyleSheet.create({results:{gap:spacing.md},title:{...typography.section,color:colors.text},result:{backgroundColor:colors.surface,padding:spacing.lg,borderRadius:radius.md,gap:spacing.sm},cause:{...typography.button,color:colors.text},check:{...typography.body,color:colors.muted}});
